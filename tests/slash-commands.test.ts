import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import type { CommandContribution, CommandUiContract } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { ActionSpec } from '@deepseek-ai/dsh-client-ui-commands/client'
import { JotIcon } from '../src/client/JotIcon.js'
import { hasJotSlashModal, registerJotSlashCommand } from '../src/client/slash-commands.js'

type SlashSession = Parameters<ActionSpec['run']>[0]
const session = (sessionId: string) => ({ sessionId } as SlashSession)

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

test('Jot contributes one localized colorful client action, with no prompt or draft operations', () => {
  const service = new CommandUiFixture()
  let chinese = true
  const opened: string[] = []
  const off = registerJotSlashCommand(service, { chinese: () => chinese, isCurrentSession: id => id === 'foreground',
    blocked: () => false, open: value => { opened.push(value.sessionId) } })
  const entry = service.contributions.get('jot')!
  assert.equal(entry.name, 'jot')
  assert.equal(entry.label!(), '打开随记')
  assert.equal(entry.description!(), '查看和编辑笔记')
  assert.equal(entry.icon, JotIcon)
  assert.equal(entry.ui.kind, 'action')
  chinese = false
  assert.equal(entry.label!(), 'Open Jot')
  assert.equal(entry.description!(), 'View and edit your notes')
  assert.equal(service.registrations, 1, 'locale changes do not add another command')
  if (entry.ui.kind === 'action') entry.ui.run(session('foreground'))
  assert.deepEqual(opened, ['foreground'])
  off()
})

test('a callback captured in an old conversation never opens the newly selected one', () => {
  const service = new CommandUiFixture()
  let current = 'conversation-a'
  const opened: string[] = []
  registerJotSlashCommand(service, { chinese: () => true, isCurrentSession: id => id === current,
    blocked: () => false, open: value => { opened.push(value.sessionId) } })
  const entry = service.contributions.get('jot')!
  assert.equal(entry.available(session('conversation-a')), true)
  current = 'conversation-b'
  assert.equal(entry.available(session('conversation-a')), false)
  if (entry.ui.kind === 'action') {
    entry.ui.run(session('conversation-a'))
    entry.ui.run(session('conversation-b'))
  }
  assert.deepEqual(opened, ['conversation-b'])
})

test('a dialog taking ownership between menu discovery and invocation blocks the action', () => {
  const service = new CommandUiFixture()
  let blocked = false
  let opened = 0
  registerJotSlashCommand(service, { chinese: () => true, isCurrentSession: () => true,
    blocked: () => blocked, open() { opened++ } })
  const entry = service.contributions.get('jot')!
  assert.equal(entry.available(session('conversation')), true)
  blocked = true
  assert.equal(entry.available(session('conversation')), false)
  if (entry.ui.kind === 'action') entry.ui.run(session('conversation'))
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

test('unregistration is idempotent, old actions are inert, and remount uses one fresh entry', () => {
  const service = new CommandUiFixture()
  let opened = 0
  const options = { chinese: () => true, isCurrentSession: () => true, blocked: () => false, open() { opened++ } }
  const off = registerJotSlashCommand(service, options)
  const old = service.contributions.get('jot')!
  off(); off()
  assert.equal(old.available(session('conversation')), false)
  if (old.ui.kind === 'action') old.ui.run(session('conversation'))
  assert.equal(opened, 0)
  assert.equal(service.releases, 1)
  const remounted = registerJotSlashCommand(service, options)
  const fresh = service.contributions.get('jot')!
  if (fresh.ui.kind === 'action') fresh.ui.run(session('conversation'))
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
