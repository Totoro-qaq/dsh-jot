import assert from 'node:assert/strict'
import { test } from 'node:test'
import { docFromMarkdown, docToMarkdown, markdownLosses } from '../src/markdown.js'
import { applyTextEdits, docToText, StoreError, validateRichDoc, type RichDoc, type RichNode } from '../src/model.js'

const code = (expected: string) => (error: unknown) => error instanceof StoreError && error.code === expected
const text = (value: string, marks?: RichNode['marks']): RichNode => marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const paragraph = (...content: RichNode[]): RichNode => content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
const doc = (...content: RichNode[]): RichDoc => validateRichDoc({ type: 'doc', content })
const roundTrip = (value: RichDoc) => docFromMarkdown(docToMarkdown(value))
const file = 'a'.repeat(32)

/** The note from the report: one changed word must not cost its structure. */
const plan = doc(
  { type: 'heading', attrs: { level: 2 }, content: [text('发布计划')] },
  { type: 'bulletList', content: [
    { type: 'listItem', content: [paragraph(text('周五前确认'), text('验收范围', [{ type: 'bold' }]))] },
    { type: 'listItem', content: [paragraph(text('回归见'), text('测试文档', [{ type: 'link', attrs: { href: 'https://example.com/qa' } }]))] },
  ] },
  { type: 'blockquote', content: [paragraph(text('不要在周末发版'))] },
  { type: 'codeBlock', attrs: { language: 'sh' }, content: [text('# 先跑检查\npnpm check')] },
  { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('写更新记录'))] }] },
)

test('agents read headings, lists, marks, links, quotes and code as Markdown that converts back unchanged', () => {
  const markdown = docToMarkdown(plan)
  assert.equal(markdown, ['## 发布计划', '- 周五前确认**验收范围**\n- 回归见[测试文档](https://example.com/qa)', '> 不要在周末发版',
    '```sh\n# 先跑检查\npnpm check\n```', '- [x] 写更新记录'].join('\n\n'))
  assert.deepEqual(roundTrip(plan), plan)
  assert.deepEqual(markdownLosses(plan), [])
  // A rewrite of the Markdown the agent read changes the word and nothing else.
  const rewritten = docFromMarkdown(markdown.replace('周五', '周四'))
  assert.equal(docToText(rewritten), docToText(plan).replace('周五', '周四'))
  assert.deepEqual(rewritten.content.map(block => block.type), plan.content.map(block => block.type))
})

test('colors, underline, highlight and overlapping marks use tags that convert back exactly', () => {
  const styled = doc(paragraph(text('红字', [{ type: 'textStyle', attrs: { color: '#dc2626' } }]), text('下划线', [{ type: 'underline' }]),
    text('高亮', [{ type: 'highlight', attrs: { color: '#fef08a' } }]), text('绿底', [{ type: 'highlight', attrs: { color: '#bbf7d0' } }]),
    text('粗斜', [{ type: 'bold' }, { type: 'italic' }]), text('斜', [{ type: 'italic' }]), text('粗', [{ type: 'bold' }])))
  const markdown = docToMarkdown(styled)
  assert.match(markdown, /<span style="color:#dc2626">红字<\/span><u>下划线<\/u><mark>高亮<\/mark><span style="background-color:#bbf7d0">绿底<\/span>/u)
  assert.deepEqual(markdownLosses(styled), [])
  assert.deepEqual(docToMarkdown(roundTrip(styled)), markdown)
  // Bold that starts at a space keeps its delimiters valid by leaving the space outside.
  const spaced = doc(paragraph(text('a'), text(' b ', [{ type: 'bold' }]), text('c')))
  assert.equal(docToMarkdown(spaced), 'a **b** c')
  assert.deepEqual(markdownLosses(spaced), [])
})

test('nested lists, numbering, images and files survive; literal Markdown characters are escaped', () => {
  const nested = doc({ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('parent')),
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('child')),
      { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [paragraph(text('deep'))] }] }] }] },
    paragraph(text('second paragraph'))] }] })
  assert.equal(docToMarkdown(nested), '- parent\n  - [ ] child\n    3. deep\n  second paragraph')
  assert.deepEqual(roundTrip(nested), nested)

  const files = doc(paragraph(text('see')), { type: 'image', attrs: { attachmentId: file, alt: 'shot [1]' } },
    { type: 'attachment', attrs: { attachmentId: file, caption: 'report.pdf' } })
  assert.equal(docToMarkdown(files), `see\n\n![shot \\[1\\]](attachment:${file})\n\n[report.pdf](attachment:${file})`)
  assert.deepEqual(roundTrip(files), files)

  const literal = doc(paragraph(text('1. not a list')), paragraph(text('# not a heading')), paragraph(text('- dash')),
    paragraph(text('a*b*c 2*3*4 snake_case <div>x</div> &amp; C:\\Users ~~no~~ ==no== [x](y) \\')))
  assert.deepEqual(markdownLosses(literal), [])
  assert.deepEqual(roundTrip(literal), literal)
})

test('only layout Markdown cannot carry counts as a loss', () => {
  const simple = doc({ type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('A'))] }, { type: 'tableHeader', content: [paragraph(text('B|C'))] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph(text('1', [{ type: 'bold' }]))] }, { type: 'tableCell', content: [paragraph(text('a|b', [{ type: 'code' }]))] }] },
  ] })
  assert.equal(docToMarkdown(simple), '| A | B\\|C |\n| --- | --- |\n| **1** | `a\\|b` |')
  assert.deepEqual(markdownLosses(simple), [])
  const sized = doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colwidth: [120] }, content: [paragraph(text('A'))] }] }] })
  assert.deepEqual(markdownLosses(sized), ['table layout (merged cells, column widths, cell alignment or cells with several blocks)'])
  const breaks = doc(paragraph(text('line one'), { type: 'hardBreak' }, text('line two')), paragraph(), paragraph(text('after a blank line')))
  assert.deepEqual(markdownLosses(breaks), [], 'line breaks use <br>; blank paragraphs are spacing, not formatting')
})

test('agent Markdown keeps earlier input behaviour and adds nesting, CJK emphasis and escapes', () => {
  const parsed = docFromMarkdown(['- [ ] Draft', '[x] Bare task', '', '- one', '* two', '', '4) four', '- a', '  - nested',
    '这是*强调*和**重点**', 'snake_case_name 2\\*3 &amp; <b>bold</b> <span style="color:red">unknown color</span>'].join('\n'))
  assert.deepEqual(parsed.content.map(block => block.type), ['taskList', 'bulletList', 'orderedList', 'bulletList', 'paragraph', 'paragraph'])
  assert.equal(parsed.content[0]!.content!.length, 2)
  assert.equal(parsed.content[2]!.attrs!.start, 4)
  assert.equal(parsed.content[3]!.content![0]!.content![1]!.type, 'bulletList')
  assert.deepEqual(parsed.content[4]!.content!.map(node => [node.text, node.marks?.[0]?.type ?? null]),
    [['这是', null], ['强调', 'italic'], ['和', null], ['重点', 'bold']])
  assert.deepEqual(parsed.content[5]!.content!.map(node => [node.text, node.marks?.[0]?.type ?? null]),
    [['snake_case_name 2*3 & ', null], ['bold', 'bold'], [' unknown color', null]])
  // A file is only referenced from a line of its own, and only by its stored id.
  const inline = docFromMarkdown(`see ![x](attachment:${file}) here\n![y](attachment:nothex)`)
  assert.deepEqual(inline.content.map(block => block.type), ['paragraph', 'image', 'paragraph', 'paragraph'])
  assert.throws(() => docFromMarkdown('x'.repeat(200_001)), code('INVALID_INPUT'))
})

test('find and replace changes exactly the matched text and keeps the formatting around it', () => {
  const { content, counts } = applyTextEdits(plan, [{ find: '周五', replace: '周四' }, { find: '验收范围', replace: '交付范围' }])
  assert.deepEqual(counts, [1, 1])
  assert.equal(docToMarkdown(content).split('\n')[2], '- 周四前确认**交付范围**', 'the replacement takes the replaced text’s marks')
  assert.deepEqual(content.content.slice(2), plan.content.slice(2))
  const script = applyTextEdits(plan, [{ find: 'pnpm check', replace: 'pnpm test\npnpm build' }]).content
  assert.equal(script.content[3]!.content![0]!.text, '# 先跑检查\npnpm test\npnpm build')
  const twice = doc(paragraph(text('A and A')), paragraph(text('A')))
  assert.throws(() => applyTextEdits(twice, [{ find: 'A', replace: 'B' }]), /appears 3 times/u)
  assert.equal(docToText(applyTextEdits(twice, [{ find: 'A', replace: 'B', all: true }]).content), 'B and B\nB')
  assert.throws(() => applyTextEdits(plan, [{ find: '周四', replace: 'x' }]), /not in the note/u)
  assert.throws(() => applyTextEdits(plan, [{ find: '**验收范围**', replace: 'x' }]), /without Markdown markers/u)
  // All or nothing: a failing second edit leaves the first unapplied, because nothing is returned.
  assert.throws(() => applyTextEdits(plan, [{ find: '周五', replace: '周四' }, { find: 'missing', replace: '' }]), /Edit 2/u)
  assert.throws(() => applyTextEdits(plan, []), code('INVALID_INPUT'))
  const removed = applyTextEdits(doc(paragraph(text('keep '), text('drop', [{ type: 'bold' }]))), [{ find: ' drop', replace: '' }]).content
  assert.deepEqual(removed.content, [paragraph(text('keep'))])
})
