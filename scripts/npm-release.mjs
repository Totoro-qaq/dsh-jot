import { appendFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const PACKAGE = 'dsh-jot'
const REPOSITORY = 'git+https://github.com/Totoro-qaq/dsh-jot.git'
const REGISTRY = 'https://registry.npmjs.org'
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u

export function releaseVersion(tag) {
  if (typeof tag !== 'string' || tag.length > 128 || !tag.startsWith('v') || !STABLE.test(tag.slice(1))) {
    throw new Error('Release tag must be a stable vX.Y.Z version')
  }
  return tag.slice(1)
}

export function validatePackage(tag, manifest) {
  const version = releaseVersion(tag)
  if (manifest.name !== PACKAGE || manifest.version !== version) throw new Error('Release tag and package identity/version differ')
  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  if (repository !== REPOSITORY || manifest.publishConfig?.registry?.replace(/\/$/u, '') !== REGISTRY || manifest.publishConfig?.access !== 'public') {
    throw new Error('Unexpected release repository or npm destination')
  }
  return version
}

export function releaseDecision(version, registry) {
  if (registry?.name !== PACKAGE || !registry.versions || typeof registry.versions !== 'object' || Array.isArray(registry.versions)) {
    throw new Error('Invalid npm package metadata')
  }
  if (Object.hasOwn(registry.versions, version)) {
    const existing = registry.versions[version]
    if (existing?.name !== PACKAGE || existing.version !== version) throw new Error('Invalid existing npm version')
    return { publish: false, reason: `${PACKAGE}@${version} is already published; leaving it unchanged` }
  }
  const latest = registry['dist-tags']?.latest
  if (typeof latest !== 'string' || !STABLE.test(latest) || registry.versions[latest]?.version !== latest || registry.versions[latest]?.name !== PACKAGE) {
    throw new Error('Cannot determine the current stable npm latest')
  }
  const target = version.split('.').map(BigInt)
  const current = latest.split('.').map(BigInt)
  const differing = target.findIndex((part, index) => part !== current[index])
  if (differing < 0 || target[differing] < current[differing]) throw new Error('Refusing to move npm latest backwards')
  return { publish: true, reason: `Publish ${PACKAGE}@${version}, newer than latest ${latest}` }
}

export async function readRegistry(fetcher = fetch) {
  const response = await fetcher(`${REGISTRY}/${PACKAGE}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
  // A failed lookup is never proof that a version is missing.
  if (!response.ok) throw new Error(`npm metadata request failed: HTTP ${response.status}`)
  return response.json()
}

export function provenanceEnvironment(tag, commit, environment = process.env) {
  releaseVersion(tag)
  if (!/^[0-9a-f]{40,64}$/u.test(commit)) throw new Error('Invalid candidate commit for provenance')
  // A manual retry runs the workflow from main, but the material is the
  // checked-out release tag. Keep the signed workflow/OIDC identity intact.
  return { ...environment, GITHUB_REF: `refs/tags/${tag}`, GITHUB_SHA: commit }
}

export async function publishArchive({ version, tag, commit, archive, directory, load = readRegistry, run = spawnSync }) {
  if (releaseVersion(tag) !== version) throw new Error('Publication tag/version differ')
  const decision = releaseDecision(version, await load())
  if (!decision.publish) return decision
  const result = run('npm', ['publish', resolve(archive), '--ignore-scripts', '--access', 'public', '--tag', 'latest',
    '--provenance', `--registry=${REGISTRY}`], { cwd: directory, stdio: 'inherit', shell: false,
    env: provenanceEnvironment(tag, commit) })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`npm publish failed (${result.signal ?? result.status})`)
  return { publish: true, reason: `${PACKAGE}@${version} published with OIDC provenance` }
}

async function main() {
  const [command, tag, directory = '.', archive] = process.argv.slice(2)
  if (command === 'validate-tag') {
    console.log(releaseVersion(tag))
    return
  }
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'))
  const version = validatePackage(tag, manifest)
  if (command === 'preflight') {
    const decision = releaseDecision(version, await readRegistry())
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `publish=${decision.publish}\nversion=${version}\n`)
    console.log(decision.reason)
  } else if (command === 'publish' && archive) {
    const source = spawnSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8', shell: false })
    if (source.error || source.status !== 0) throw new Error('Cannot identify the checked-out release commit')
    console.log((await publishArchive({ version, tag, commit: source.stdout.trim(), archive, directory })).reason)
  } else throw new Error('Use validate-tag, preflight, or publish with an archive')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
