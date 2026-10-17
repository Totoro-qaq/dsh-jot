import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

test('optional exporter import failures do not prevent notes or plain-text exports from loading', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    const attempted = [];
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'docx' || specifier.startsWith('pdfkit')) {
        attempted.push(specifier);
        throw Object.assign(new Error('fixture optional dependency is unavailable'), { code: 'MODULE_NOT_FOUND' });
      }
      return next(specifier, context);
    } });
    const { createJotHandler } = await import('./src/http.ts');
    const exports = await import('./src/exports.ts');
    assert.equal(typeof createJotHandler, 'function');
    const input = { title: 'Still editable', content: { type: 'doc', content: [{ type: 'paragraph', content: [{type:'text', text:'Notes survive'}] }] } };
    assert.match((await exports.exportJotNote(input, 'txt')).buffer.toString(), /Notes survive/);
    assert.match((await exports.exportJotNote(input, 'md')).buffer.toString(), /Notes survive/);
    assert.deepEqual(attempted, [], 'plain text never loads optional engines');
    console.log('isolated');
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 })
  assert.match(output, /isolated/u)
})
