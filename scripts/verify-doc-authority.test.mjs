import assert from 'node:assert/strict'
import { mkdtemp, cp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
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
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0)
  assert.equal(spawnSync('git', ['add', '-A'], { cwd: root }).status, 0)
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

async function track(root, relative, source) {
  const file = path.join(root, relative)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, source)
  assert.equal(spawnSync('git', ['add', '--', relative], { cwd: root }).status, 0)
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

test('rejects a missing source route even when a comment retains its old marker', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      "router.post('/email/request'",
      "// router.post('/email/request')\n  router.post('/email/request-renamed'",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source authority is missing POST \/api\/v1\/auth\/email\/request/)
})

test('rejects an unclassified extra source route', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      "router.post('/email/request'",
      "router.get('/debug', (_req, res) => res.sendStatus(204))\n\n  router.post('/email/request'",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unclassified source route GET \/api\/v1\/auth\/debug/)
})

test('rejects mount drift even when a comment retains the expected mount marker', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      "  app.use(\n    '/api/v1/auth',\n    createIdentityRouter(",
      "  // app.use('/api/v1/auth', createIdentityRouter())\n  app.use(\n    '/api/v2/auth',\n    createIdentityRouter(",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source authority is missing mount \/api\/v1\/auth -> createIdentityRouter/)
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

test('scans a newly tracked active document for retired claims', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await track(
    root,
    'docs/context/new-current-guide.md',
    '# Current guide\n\nUse POST /api/v1/auth/register for password login.\n',
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /docs\/context\/new-current-guide\.md contains a forbidden retired API claim/)
})

test('fails closed for a newly tracked Markdown path without a classification', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await track(root, 'misc/new-guide.md', '# Unclassified guide\n')

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /tracked Markdown is not classified as active or historical: misc\/new-guide\.md/)
})

test('rejects calendar retirement dates in active documentation', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'README.md', (source) =>
    `${source}\nPhysical deletion is allowed after 2026-07-27.\n`,
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /README\.md contains a hard-coded retirement date/)
})

test('requires the event-based retirement clock rule in active authority docs', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/manage-services.md', (source) =>
    source.replace('14 consecutive dependency-free 24-hour periods', 'fourteen quiet days'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /docs\/manage-services\.md is missing the event-based retirement clock rule/)
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

test('requires the storage completion parser 413 media contract', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/openapi.yaml', (source) =>
    source.replace(
      '            text/html:\n              schema: { type: string }\n        \'503\':',
      '            application/json:\n              schema: { $ref: \'#/components/schemas/Error\' }\n        \'503\':',
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /storage completion 413 must document text\/html with a string schema/)
})

test('requires the signed 64-bit maximum for upload sizes', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/openapi.yaml', (source) =>
    source.replace(
      "x-maximum-decimal: '9223372036854775807'",
      "x-maximum-decimal: '9223372036854775808'",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /PositiveByteString must declare signed 64-bit maximum 9223372036854775807/)
})

test('requires trimmed filename and MIME schemas with source-faithful forbidden characters', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/openapi.yaml', (source) =>
    source.replace('      x-trimmed: true', '      x-trimmed: false'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /UploadFileName must require trimmed input and forbid slash, backslash, control, and DEL characters/)
})

test('requires share passwords to use a 1024-byte UTF-8 limit', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutate(root, 'docs/openapi.yaml', (source) =>
    source.replaceAll('x-max-utf8-bytes: 1024', 'x-max-utf8-bytes: 1025'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /SharePassword must declare a 1024-byte UTF-8 limit/)
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
