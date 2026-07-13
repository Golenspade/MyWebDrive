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
    'frontend/cruip-landing/README.md',
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

async function mutateRequired(root, relative, transform) {
  const file = path.join(root, relative)
  const source = await readFile(file, 'utf8')
  const changed = transform(source)
  assert.notEqual(changed, source, `fixture mutation did not change ${relative}`)
  await writeFile(file, changed)
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

test('rejects a route registration inside a dead block', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      '  const router = express.Router()\n',
      "  const router = express.Router()\n  if (false) {\n    router.get('/dead-route', (_req, res) => res.sendStatus(204))\n  }\n",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported or dead route registration GET \/dead-route/)
})

test('rejects a route registration inside an unused helper', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      '  const router = express.Router()\n',
      "  const router = express.Router()\n  function registerDeadRoute() {\n    router.post('/email/request', (_req, res) => res.sendStatus(204))\n  }\n",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported or dead route registration POST \/email\/request/)
})

test('rejects a const-backed dynamic route path', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      "  router.post('/email/request'",
      "  const emailRequestPath = '/email/request'\n  router.post(emailRequestPath",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported dynamic route path in createIdentityRouter/)
})

test('rejects chained router.route registration', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      "router.post('/email/request', async",
      "router.route('/email/request').post(async",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported chained route registration \/email\/request/)
})

test('rejects an aliased route receiver', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace(
      "  router.post('/email/request'",
      "  const routeAlias = router\n  routeAlias.post('/email/request'",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported aliased route receiver routeAlias/)
})

test('rejects an unresolved Express receiver binding', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace("import express from 'express'", "import expressRuntime from 'express'"),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /source authority cannot resolve default Express binding/)
})

test('rejects a nested dead Core mount', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      "  app.use(\n    '/api/v1/auth',",
      "  if (false) {\n    app.use('/api/v1/auth', createIdentityRouter({} as never))\n  }\n\n  app.use(\n    '/api/v1/auth',",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported or dead Core mount \/api\/v1\/auth -> createIdentityRouter/)
})

test('rejects a dynamic Core mount prefix', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      "  app.use(\n    '/api/v1/auth',",
      "  const identityMountPrefix = '/api/v1/auth'\n  app.use(\n    identityMountPrefix,",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported dynamic Core mount prefix in createCoreApp/)
})

test('rejects an indirect Core mount factory', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      "  app.use(\n    '/api/v1/auth',\n    createIdentityRouter(",
      "  const identityRouterFactory = createIdentityRouter\n\n  app.use(\n    '/api/v1/auth',\n    identityRouterFactory(",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unsupported indirect Core mount factory identityRouterFactory/)
})

test('rejects a Core router factory imported from the wrong module', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace("from './identity/router.js'", "from './identity/not-the-router.js'"),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /cannot resolve Core router factory binding createIdentityRouter from \.\/identity\/router\.js/)
})

test('ignores a type-only namespace that cannot shadow a runtime import', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      "export type { EmailSender, SendOtpInput } from './identity/email-sender.js'",
      "namespace createIdentityRouter { export type Marker = never }\n\nexport type { EmailSender, SendOtpInput } from './identity/email-sender.js'",
    ),
  )

  const result = runVerifier(root)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /documentation authority: ok/)
})

test('rejects a local binding that shadows an imported Core router factory', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      'export function createCoreApp(deps: CoreDependencies): express.Express {\n',
      'export function createCoreApp(deps: CoreDependencies): express.Express {\n  const createIdentityRouter = () => express.Router()\n',
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /runtime import binding createIdentityRouter from \.\/identity\/router\.js is shadowed/)
})

test('rejects a parameter that shadows an imported Core router factory', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace(
      'export function createCoreApp(deps: CoreDependencies): express.Express {',
      'export function createCoreApp(deps: CoreDependencies, createIdentityRouter = () => express.Router()): express.Express {',
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /runtime import binding createIdentityRouter from \.\/identity\/router\.js is shadowed/)
})

test('rejects a router factory returning a fresh receiver', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/identity/router.ts', (source) =>
    source.replace('  return router\n}', '  return express.Router()\n}'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /factory createIdentityRouter must directly return its bound router/)
})

test('rejects the Core app factory returning a fresh receiver', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/app.ts', (source) =>
    source.replace('  return app\n}', '  return express()\n}'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /factory createCoreApp must directly return its bound app/)
})

test('rejects the Storage API router factory returning a fresh receiver', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/storage/src/api.ts', (source) =>
    source.replace('  return router\n}', '  return express.Router()\n}'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /factory createStorageApi must directly return its bound router/)
})

test('rejects a dead helper standing in for the Storage runtime binding', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/storage/src/index.ts', (source) =>
    `${source.replace('const app = createStorageApiApp({', 'const app = createStorageApiAppRenamed({')}\nfunction deadStorageBinding() {\n  return createStorageApiApp({ router: createStorageApi({} as never) })\n}\n`,
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Storage API runtime binding must be direct in the api command branch/)
})

test('rejects destructured shadows in the Storage API runtime binding chain', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/storage/src/index.ts', (source) =>
    source.replace(
      "  if (command === 'api') {\n",
      "  if (command === 'api') {\n    const { createApiRuntime, connectRuntimeRedis, createStorageApi, createStorageApiApp } = {} as never\n",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /runtime import binding createApiRuntime from \.\/runtime\.js is shadowed/)
  assert.match(result.stderr, /runtime import binding connectRuntimeRedis from \.\/runtime\.js is shadowed/)
  assert.match(result.stderr, /runtime import binding createStorageApi from \.\/api\.js is shadowed/)
  assert.match(result.stderr, /runtime import binding createStorageApiApp from \.\/server\.js is shadowed/)
})

test('rejects a dead helper standing in for the Storage API router mount', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/storage/src/server.ts', (source) =>
    `${source.replace('  app.use(input.router)\n', '  app.use(input.otherRouter)\n')}\nfunction deadStorageRouterMount(app: express.Express, input: { router: express.Router }) {\n  app.use(input.router)\n}\n`,
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Storage API router mount must be direct in createStorageApiApp/)
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

test('rejects source drift in the upload signed-64-bit maximum', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/uploads/service.ts', (source) =>
    source.replace('9_223_372_036_854_775_807n', '9_223_372_036_854_775_806n'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /PositiveByteString maximum does not match upload source validator/)
})

test('rejects source drift in the upload filename forbidden-character regex', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/uploads/service.ts', (source) =>
    source.replace(
      String.raw`/[\\/\x00-\x1f\x7f]/.test(fileName)`,
      String.raw`/[\\/\x00-\x20\x7f]/.test(fileName)`,
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /UploadFileName pattern does not match upload source validator/)
})

test('rejects source drift in the upload MIME forbidden-character regex', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/uploads/service.ts', (source) =>
    source.replace(
      String.raw`/[\x00-\x1f\x7f]/.test(body.mimeType)`,
      String.raw`/[\x00-\x20\x7f]/.test(body.mimeType)`,
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /UploadMimeType pattern does not match upload source validator/)
})

test('fails closed when upload trim validation becomes unsupported', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/uploads/service.ts', (source) =>
    source.replace('body.fileName !== body.fileName.trim()', 'body.fileName !== body.fileName.trimStart()'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /could not resolve upload source validator: fileName trim guard/)
})

test('rejects source drift in the share-password UTF-8 byte ceiling', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/sharing/service.ts', (source) =>
    source.replace('const PASSWORD_MAX_BYTES = 1024', 'const PASSWORD_MAX_BYTES = 1025'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /SharePassword byte limit does not match sharing source validator/)
})

test('fails closed when a source validator constant is no longer statically resolvable', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'services/core-api/src/sharing/service.ts', (source) =>
    source.replace('const PASSWORD_MAX_BYTES = 1024', 'const PASSWORD_MAX_BYTES = 512 * 2'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /could not resolve sharing source validator: PASSWORD_MAX_BYTES/)
})

test('requires the persistent Storage parser runtime contract test', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await unlink(path.join(root, 'services/storage/src/__tests__/completion-parser-contract.test.ts'))

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /persistent Storage completion parser runtime contract is missing/)
})

test('rejects a weakened Storage parser test without an oversized send and response assertions', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(
    root,
    'services/storage/src/__tests__/completion-parser-contract.test.ts',
    (source) => source
      .replace('    const response = await request(app)', '    await request(app)')
      .replace("\n      .send({ padding: 'x'.repeat(2048) })", '')
      .replace('expect(response.status).toBe(413)', 'expect(413).toBe(413)')
      .replace(
        "expect(response.headers['content-type']).toBe('text/html; charset=utf-8')",
        "expect('text/html; charset=utf-8').toBe('text/html; charset=utf-8')",
      )
      .replace(
        'expect(response.text).toMatch(/^<!DOCTYPE html>/)',
        "expect('<!DOCTYPE html>').toMatch(/^<!DOCTYPE html>/)",
      ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /persistent Storage completion parser runtime contract has weakened request or assertions/)
})

test('rejects Storage parser assertions against an unrelated response object', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(
    root,
    'services/storage/src/__tests__/completion-parser-contract.test.ts',
    (source) => source
      .replace(
        '    expect(response.status).toBe(413)',
        "    const otherResponse = { status: 413, headers: { 'content-type': 'text/html; charset=utf-8' }, text: '<!DOCTYPE html>' }\n\n    expect(otherResponse.status).toBe(413)",
      )
      .replace("expect(response.headers['content-type'])", "expect(otherResponse.headers['content-type'])")
      .replace('expect(response.text)', 'expect(otherResponse.text)'),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /persistent Storage completion parser runtime contract has weakened request or assertions/)
})

test('rejects the Storage parser contract when app factories come from the wrong module', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(
    root,
    'services/storage/src/__tests__/completion-parser-contract.test.ts',
    (source) => source.replace("from '../server.js'", "from '../not-server.js'"),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /persistent Storage completion parser runtime contract has unresolved imports/)
})

test('rejects local bindings that shadow imported Storage parser test authorities', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(
    root,
    'services/storage/src/__tests__/completion-parser-contract.test.ts',
    (source) => source.replace(
      "  test('preserves Express default HTML for oversized completion JSON', async () => {\n",
      "  test('preserves Express default HTML for oversized completion JSON', async () => {\n    const request = () => ({})\n    const createStorageApi = () => ({})\n    const createStorageApiApp = () => ({})\n",
    ),
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /runtime import binding request from supertest is shadowed/)
  assert.match(result.stderr, /runtime import binding createStorageApi from \.\.\/api\.js is shadowed/)
  assert.match(result.stderr, /runtime import binding createStorageApiApp from \.\.\/server\.js is shadowed/)
})

test('rejects stale Nextra 3 claims in the active frontend README', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await mutateRequired(root, 'frontend/cruip-landing/README.md', (source) =>
    `${source}\nRetired documentation stack: Nextra 3.\n`,
  )

  const result = runVerifier(root)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /frontend\/cruip-landing\/README\.md contains a stale Nextra 3 claim/)
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
