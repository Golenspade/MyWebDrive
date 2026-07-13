import assert from 'node:assert/strict'
import { mkdtemp, cp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const verifier = path.join(repositoryRoot, 'scripts/verify-doc-authority.mjs')

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'mywebdrive-doc-authority-'))
  for (const relative of [
    '.redocly.lint-ignore.yaml',
    'AGENTS.md',
    'CLAUDE.md',
    'CONTEXT.md',
    'CONTRIBUTING.md',
    'README.md',
    'SECURITY.md',
    'docs/context/dashboard-analytics.md',
    'docs/manage-services.md',
    'docs/openapi.yaml',
    'docs/runbooks/core-cutover-and-rollback.md',
    'infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md',
    'infrastructure/alicloud/deploy.sh',
    'infrastructure/alicloud/docker-compose.core.yml',
    'infrastructure/alicloud/rollback.sh',
    'manage-services.sh',
    'scripts/smoke-core-e2e.sh',
    'services/core-api/src',
    'services/storage/src',
  ]) {
    try {
      await cp(path.join(repositoryRoot, relative), path.join(root, relative), {
        recursive: true,
      })
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return root
}

function runVerifier(root) {
  return spawnSync(process.execPath, [verifier, '--root', root], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
}

async function mutate(root, relative, transform) {
  const file = path.join(root, relative)
  await writeFile(file, transform(await readFile(file, 'utf8')))
}

test('accepts the current source, OpenAPI, and active documentation authority', () => {
  const result = runVerifier(repositoryRoot)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /documentation authority: ok/)
})

test('rejects a critical public operation missing from OpenAPI', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/openapi.yaml', (source) =>
    source.replace(/  \/api\/v1\/auth\/email\/request:\n[\s\S]*?(?=  \/api\/v1\/auth\/email\/verify:)/, ''),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /OpenAPI is missing POST \/api\/v1\/auth\/email\/request/)
})

test('rejects a critical operation whose source route marker disappears', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace("router.post('/email/request'", "router.post('/email/request-renamed'"),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source authority is missing POST \/api\/v1\/auth\/email\/request/)
})

test('rejects retired register and password-login claims in active docs', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'README.md', (source) =>
    `${source}\nCurrent API: POST /api/v1/auth/register for password login.\n`,
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /README\.md contains a forbidden retired API claim/)
})

test('rejects internal or operational paths exposed as public OpenAPI paths', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/openapi.yaml', (source) =>
    source.replace(
      '\npaths:\n',
      "\npaths:\n  /api/v1/internal/probe:\n    get:\n      responses:\n        '200': { description: leaked }\n",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /OpenAPI exposes private or operational path \/api\/v1\/internal\/probe/)
})

test('rejects an OpenAPI lint exception broader than idempotent logout', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(
    path.join(root, '.redocly.lint-ignore.yaml'),
    "docs/openapi.yaml:\n  operation-4xx-response:\n    - '#/paths'\n",
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Redocly lint exception must be scoped to idempotent logout/)
})

test('fails closed when OpenAPI cannot be parsed', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(path.join(root, 'docs/openapi.yaml'), 'openapi: [not valid\n')

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /could not parse docs\/openapi\.yaml/i)
})

test('fails closed when a referenced deployment authority is missing', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await unlink(path.join(root, 'infrastructure/alicloud/deploy.sh'))

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /referenced authority path is missing: infrastructure\/alicloud\/deploy\.sh/)
})
