import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import type { CommandContribution, CommandUiContract } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { PopupSelectSpec, SelectOption } from '@deepseek-ai/dsh-client-ui-commands/client'
import { JotIcon } from '../src/client/JotIcon.js'
import { hasJotSlashModal, jotSlashOptions, registerJotSlashCommand, SLASH_RECENT_LIMIT, type JotSlashChoice } from '../src/client/slash-commands.js'
import type { Note } from '../src/client/types.js'

type SlashSession = Parameters<PopupSelectSpec['onSelect']>[1]
const session = (sessionId: string) => ({ sessionId } as SlashSession)
const picker = (entry: CommandContribution) => {
  assert.equal(entry.ui.kind, 'popupSelect')
  return entry.ui as PopupSelectSpec
}
/** Settle one picker row the way the official shell does; a rejection keeps "/jot" in the composer. */
async function choose(entry: CommandContribution, value: SlashSession, id = 'open') {
  try { await picker(entry).onSelect({ id, label: id } as SelectOption, value); return true }
  catch { return false }
}

class CommandUiFixture implements Pick<CommandUiContract, 'register'> {
  readonly contributions = new Map<string, CommandContribution>()
  registrations = 0
  releases = 0
  register(contribution: CommandContribution) {
    if (this.contributions.has(contribution.name)) throw new Error('duplicate contribution')
    this.contributions.set(contribution.name, contribution)
    this.registrations++
    return () => {
      if (this.contributions.get(contribution.name) !== contribution) return
      this.contributions.delete(contribution.name)
      this.releases++
    }
  }
}

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id, title: id, content: { type: 'doc', content: [{ type: 'paragraph' }] }, text: '', folderId: null, pinned: false,
  revision: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null, ...patch,
})

test('Jot contributes one localized colorful picker that opens, creates or finds a note', async () => {
  const service = new CommandUiFixture()
  let chinese = true
  const opened: Array<[string, JotSlashChoice]> = []
  const off = registerJotSlashCommand(service, { chinese: () => chinese, isCurrentSession: id => id === 'foreground',
    blocked: () => false, open: (value, choice) => { opened.push([value.sessionId, choice]) },
    loadLibrary: async () => ({ notes: [note('a', { title: '周会' })], folders: [] }) })
  const entry = service.contributions.get('jot')!
  assert.equal(entry.name, 'jot')
  assert.equal(entry.label!(), '打开随记')
  assert.equal(entry.description!(), '打开、新建或找到一篇笔记')
  assert.equal(entry.icon, JotIcon)
  assert.deepEqual(picker(entry).searchLabels!(), { placeholder: '搜索笔记', empty: '还没有笔记', noResults: '没有找到笔记' })
  const rows = await picker(entry).options(session('foreground'), new AbortController().signal)
  assert.deepEqual(rows.map(row => row.id), ['open', 'new', 'note:a'])
  assert.equal(rows.find(row => row.active)?.id, 'open', 'Enter twice keeps opening Jot')
  chinese = false
  assert.equal(entry.label!(), 'Open Jot')
  assert.equal(entry.description!(), 'Open, start or find a note')
  assert.equal(service.registrations, 1, 'locale changes do not add another command')
  assert.equal(await choose(entry, session('foreground'), 'open'), true)
  assert.equal(await choose(entry, session('foreground'), 'new'), true)
  assert.equal(await choose(entry, session('foreground'), 'note:a'), true)
  assert.equal(await choose(entry, session('foreground'), 'note:'), false, 'an unknown row consumes nothing')
  assert.deepEqual(opened, [['foreground', { action: 'open' }], ['foreground', { action: 'new' }],
    ['foreground', { action: 'open-note', noteId: 'a' }]])
  off()
})

test('picker rows put pinned notes first, skip Trash, describe each note and cap recent rows', () => {
  const now = new Date('2026-10-05T12:00:00.000Z')
  const rows = jotSlashOptions({ folders: [{ id: 'f', name: '产品讨论' }], notes: [
    note('old', { title: '', text: '第一行代替标题\n正文', updatedAt: '2026-10-01T00:00:00.000Z' }),
    note('pin', { title: '置顶笔记', pinned: true, folderId: 'f', updatedAt: '2026-09-01T00:00:00.000Z',
      content: { type: 'doc', content: [{ type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }] } }),
    note('new', { title: '最新', updatedAt: '2026-10-04T00:00:00.000Z' }),
    note('gone', { title: '已删除', deletedAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z' }),
  ] }, true, now)
  assert.deepEqual(rows.map(row => row.id), ['open', 'new', 'note:pin', 'note:new', 'note:old'])
  assert.deepEqual(rows.map(row => row.group?.label), ['随记', '随记', '置顶', '最近', '最近'])
  const pinned = rows.find(row => row.id === 'note:pin')!
  assert.match(pinned.detail!, /^产品讨论 · .+ · 1\/2$/u)
  assert.equal(rows.find(row => row.id === 'note:old')!.label, '第一行代替标题', 'untitled notes borrow their first line')
  assert.deepEqual(jotSlashOptions(null, false).map(row => row.label), ['Open Jot', 'New note'])
  const many = Array.from({ length: SLASH_RECENT_LIMIT + 5 }, (_, index) => note(`n${index}`, {
    updatedAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString() }))
  assert.equal(jotSlashOptions({ notes: many, folders: [] }, true).length, 2 + SLASH_RECENT_LIMIT)
})

test('a failed note list still offers Open and New', async () => {
  const service = new CommandUiFixture()
  registerJotSlashCommand(service, { chinese: () => true, isCurrentSession: () => true, blocked: () => false, open() {},
    loadLibrary: async () => { throw new Error('offline') } })
  const rows = await picker(service.contributions.get('jot')!).options(session('conversation'), new AbortController().signal)
  assert.deepEqual(rows.map(row => row.id), ['open', 'new'])
})

test('a picker opened in an old conversation never acts in the newly selected one', async () => {
  const service = new CommandUiFixture()
  let current = 'conversation-a'
  const opened: string[] = []
  registerJotSlashCommand(service, { chinese: () => true, isCurrentSession: id => id === current,
    blocked: () => false, open: value => { opened.push(value.sessionId) } })
  const entry = service.contributions.get('jot')!
  assert.equal(entry.available(session('conversation-a')), true)
  current = 'conversation-b'
  assert.equal(entry.available(session('conversation-a')), false)
  assert.equal(await choose(entry, session('conversation-a')), false, 'the stale choice is refused and keeps its token')
  assert.equal(await choose(entry, session('conversation-b')), true)
  assert.deepEqual(opened, ['conversation-b'])
})

test('a dialog taking ownership between menu discovery and choice blocks the picker', async () => {
  const service = new CommandUiFixture()
  let blocked = false
  let opened = 0
  registerJotSlashCommand(service, { chinese: () => true, isCurrentSession: () => true,
    blocked: () => blocked, open() { opened++ } })
  const entry = service.contributions.get('jot')!
  assert.equal(entry.available(session('conversation')), true)
  blocked = true
  assert.equal(entry.available(session('conversation')), false)
  assert.equal(await choose(entry, session('conversation')), false)
  assert.equal(opened, 0)
})

test('duplicate registration keeps the original command and does not fail notebook activation', () => {
  const service = new CommandUiFixture()
  const foreign: CommandContribution = { name: 'jot', available: () => true, ui: { kind: 'action', run() {} } }
  service.register(foreign)
  let off: (() => void) | undefined
  assert.doesNotThrow(() => {
    off = registerJotSlashCommand(service, { chinese: () => true, isCurrentSession: () => true,
      blocked: () => false, open() { assert.fail('collision must never route') } })
  })
  off!()
  assert.equal(service.contributions.get('jot'), foreign)
  assert.equal(service.releases, 0)
})

test('unregistration is idempotent, old pickers are inert, and remount uses one fresh entry', async () => {
  const service = new CommandUiFixture()
  let opened = 0
  const options = { chinese: () => true, isCurrentSession: () => true, blocked: () => false, open() { opened++ } }
  const off = registerJotSlashCommand(service, options)
  const old = service.contributions.get('jot')!
  off(); off()
  assert.equal(old.available(session('conversation')), false)
  assert.equal(await choose(old, session('conversation')), false)
  assert.equal(opened, 0)
  assert.equal(service.releases, 1)
  const remounted = registerJotSlashCommand(service, options)
  const fresh = service.contributions.get('jot')!
  assert.equal(await choose(fresh, session('conversation')), true)
  assert.equal(opened, 1)
  remounted()
  assert.equal(service.contributions.size, 0)
  registerJotSlashCommand(undefined, options)()
})

test('modal detection ignores hidden dialogs and the slash menu itself', () => {
  assert.equal(hasJotSlashModal(undefined), false)
  const dialog = (hidden: boolean, visible: boolean) => ({ closest: () => hidden ? {} : null,
    getClientRects: () => visible ? [{}] : [] })
  const document = (dialogs: unknown[]) => ({ querySelectorAll(selector: string) {
    assert.equal(selector, '[role="dialog"][aria-modal="true"]')
    return dialogs
  } } as unknown as Document)
  assert.equal(hasJotSlashModal(document([])), false)
  assert.equal(hasJotSlashModal(document([dialog(true, true), dialog(false, false)])), false)
  assert.equal(hasJotSlashModal(document([dialog(false, true)])), true)
})

test('real Cordis child injection waits independently and cleans up on service replacement and shell unload', async t => {
  const ctx = new Context()
  let child: Fiber | undefined
  let shellActivations = 0
  const options = { chinese: () => true, isCurrentSession: () => true, blocked: () => false, open() {} }
  const shell = ctx.plugin({ name: 'jot-slash-lifetime-fixture', apply(scope: Context) {
    shellActivations++
    child = scope.inject(['commandUi'], owner => {
      owner.effect(() => registerJotSlashCommand(owner.commandUi, options), 'fixture slash action')
    })
  } })
  t.after(() => shell.dispose())
  await shell
  assert.equal(shellActivations, 1, 'the notebook can activate without the optional service')
  const first = new CommandUiFixture()
  const removeFirst = ctx.provide('commandUi', first)
  await child!.await()
  assert.equal(first.contributions.size, 1)
  const old = first.contributions.get('jot')!
  removeFirst()
  await child!.await()
  assert.equal(first.contributions.size, 0)
  assert.equal(old.available(session('conversation')), false)
  const second = new CommandUiFixture()
  const removeSecond = ctx.provide('commandUi', second)
  t.after(removeSecond)
  await child!.await()
  assert.equal(second.contributions.size, 1)
  assert.equal(shellActivations, 1, 'service replacement restarts only the slash child')
  await shell.dispose()
  assert.equal(second.contributions.size, 0)
})
