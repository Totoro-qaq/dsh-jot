import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8')

test('publish run title identifies the exact release tag, including manual retries', () => {
  assert.deepEqual(workflow.match(/^run-name: .+$/gmu), [
    'run-name: Publish dsh-jot ${{ github.event.release.tag_name || inputs.tag }}',
  ])
})

test('run metadata preserves guarded release and main-only manual retry triggers', () => {
  assert.match(workflow, /^on:\n  release:\n    types: \[published\]\n  workflow_dispatch:\n    inputs:\n      tag:/mu)
  assert.match(workflow, /required: true\n        type: string/u)
  assert.ok(workflow.includes("github.repository == 'Totoro-qaq/dsh-jot' &&"))
  assert.ok(workflow.includes("github.event_name == 'release' && !github.event.release.prerelease"))
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"))
})

test('run metadata leaves reviewed source checkout and trusted publishing intact', () => {
  assert.match(workflow, /^permissions:\n  contents: read\n  id-token: write$/mu)
  assert.ok(workflow.includes('RELEASE_TAG: ${{ github.event.release.tag_name || inputs.tag }}'))
  assert.match(workflow, /ref: main\n          persist-credentials: false/u)
  assert.match(workflow, /ref: \$\{\{ env\.RELEASE_TAG \}\}\n          path: candidate\n          fetch-depth: 0\n          persist-credentials: false/u)
  assert.ok(workflow.includes('git merge-base --is-ancestor HEAD refs/remotes/origin/main'))
  assert.ok(workflow.includes('run: node scripts/npm-release.mjs publish "$RELEASE_TAG" candidate "$RUNNER_TEMP/dsh-jot-$RELEASE_VERSION.tgz"'))
})
