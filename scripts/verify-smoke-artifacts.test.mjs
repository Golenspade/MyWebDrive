import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertSafeArtifactTree,
  redactPlaywrightReportJson,
  redactSensitiveText,
} from './verify-smoke-artifacts.mjs'

test('redacts Playwright JSON structurally and preserves safe diagnostics', () => {
  const encoded = Buffer.from('Authorization: Bearer reviewer.secret.token').toString('base64url')
  const output = redactPlaywrightReportJson(JSON.stringify({
    status: 'failed',
    errors: [{ message: 'safe diagnostic: Authorization: Bearer reviewer.secret.token' }],
    accessToken: { nested: 'secret-access' },
    attachment: encoded,
    uploadUrl: '/api/v1/storage/uploads/private%2Fupload-key/parts/7',
  }))
  const parsed = JSON.parse(output)
  assert.equal(parsed.status, 'failed')
  assert.match(parsed.errors[0].message, /safe diagnostic:/)
  assert.equal(parsed.accessToken, '<redacted>')
  assert.equal(parsed.uploadUrl, '/api/v1/storage/uploads/<redacted>/parts/7')
  assert.doesNotMatch(output, /reviewer\.secret\.token|secret-access/)
  assert.equal(redactPlaywrightReportJson(output), output)
})

test('rejects invalid Playwright JSON without producing uploadable output', () => {
  assert.throws(() => redactPlaywrightReportJson('{"status":'), /valid JSON/)
})

test('redacts credential-bearing fields while preserving useful diagnostics', () => {
  const redacted = redactSensitiveText(`
Authorization: Bearer header.payload.signature
Cookie: mwd_refresh=secret-cookie
{"accessToken":"secret-access","downloadGrant":"secret-grant","objectKey":"private/key"}
X-Test-Mailbox-Token: smoke-mailbox-run-000000
CORE_SESSION_SECRET=contract-core-secret-000000
CORE_DATABASE_URL=postgresql://mywebdrive:smoke-postgres-run@postgres:5432/mywebdrive_core
REDIS_URL=redis://:smoke-redis-run@redis:6379/0
MINIO_SECRET_KEY=smoke-minio-run
MINIO_ROOT_PASSWORD=smoke-minio-root-run
recipient=user@real.invalid code=123456
fixture=healthy-admin@example.test status=partial
/api/v1/shares/private-share-token/download-ticket
/api/v1/storage/objects/private%2Fobject-key
/api/v1/storage/uploads/private%2Fupload-key/parts/7
/api/v1/storage/uploads/private-complete-key/complete
/api/v1/publications/public-release-notes/download-ticket
smoke-email-token
`)
  assert.doesNotMatch(redacted, /secret|header\.payload|private\/key|private-share-token|private%2Fobject-key|private%2Fupload-key|private-complete-key|123456|smoke-(?:mailbox|email-token|postgres|redis|minio)|user@real\.invalid/)
  assert.doesNotMatch(redacted, /postgresql:\/\/|redis:\/\//)
  assert.match(redacted, /healthy-admin@example\.test/)
  assert.match(redacted, /status=partial/)
  assert.match(redacted, /\/api\/v1\/shares\/<redacted>\/download-ticket/)
  assert.match(redacted, /\/api\/v1\/storage\/objects\/<redacted>/)
  assert.match(redacted, /\/api\/v1\/storage\/uploads\/<redacted>\/parts\/7/)
  assert.match(redacted, /\/api\/v1\/storage\/uploads\/<redacted>\/complete/)
  assert.match(redacted, /\/api\/v1\/publications\/public-release-notes\/download-ticket/)
  assert.equal(redactSensitiveText(redacted), redacted)
})

test('artifact tree accepts only allowlisted sanitized report and compose files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-safe-'))
  await mkdir(join(root, 'compose'), { recursive: true })
  await mkdir(join(root, 'playwright-report'), { recursive: true })
  await mkdir(join(root, 'test-results', 'critical-page'), { recursive: true })
  await writeFile(join(root, 'compose', 'logs.txt'), 'status=partial\n')
  await writeFile(join(root, 'compose', 'ps.txt'), 'nginx running\n')
  await writeFile(join(root, 'playwright-report', 'results.json'), '{"status":"failed","errors":["safe diagnostic"]}')
  await writeFile(join(root, 'test-results', 'critical-page', 'failure.png'), Buffer.from([137, 80, 78, 71]))
  await assertSafeArtifactTree(root)

  await writeFile(join(root, 'response.json'), '{"accessToken":"secret"}')
  await assert.rejects(() => assertSafeArtifactTree(root), /not allowlisted/)
})

test('artifact tree rejects unredacted sensitive text', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-unsafe-'))
  await mkdir(join(root, 'compose'), { recursive: true })
  await writeFile(join(root, 'compose', 'logs.txt'), 'Authorization: Bearer abc.def.ghi\n')
  await assert.rejects(() => assertSafeArtifactTree(root), /sensitive/)
})

test('artifact tree rejects sensitive text hidden in base64 and base64url report fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-encoded-'))
  await mkdir(join(root, 'playwright-report'), { recursive: true })
  const bearer = Buffer.from('Authorization: Bearer reviewer.secret.token').toString('base64')
  const databaseUrl = Buffer.from('CORE_DATABASE_URL=postgresql://mywebdrive:smoke-postgres-review@postgres:5432/mywebdrive_core').toString('base64url')
  await writeFile(join(root, 'playwright-report', 'results.json'), JSON.stringify({ bearer, databaseUrl }))
  await assert.rejects(() => assertSafeArtifactTree(root), /encoded sensitive text/)
})

test('redactor removes encoded credentials and remains idempotent', () => {
  const encoded = Buffer.from('Authorization: Bearer reviewer.secret.token').toString('base64')
  const redacted = redactSensitiveText(JSON.stringify({ body: encoded, message: 'useful failure' }))
  assert.doesNotMatch(redacted, new RegExp(encoded))
  assert.match(redacted, /useful failure/)
  assert.equal(redactSensitiveText(redacted), redacted)
})

test('artifact tree rejects credential-bearing URLs and smoke service credentials', async () => {
  for (const value of [
    'postgresql://mywebdrive:smoke-postgres-review@postgres:5432/mywebdrive_core',
    'REDIS_URL=redis://:smoke-redis-review@redis:6379/0',
    'MINIO_SECRET_KEY=smoke-minio-review',
    'MINIO_ROOT_PASSWORD=smoke-minio-root-review',
  ]) {
    const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-connection-'))
    await mkdir(join(root, 'compose'), { recursive: true })
    await writeFile(join(root, 'compose', 'logs.txt'), `${value}\n`)
    await assert.rejects(() => assertSafeArtifactTree(root), /sensitive/)
  }
})

test('artifact tree rejects bare email tokens and credential-bearing API path segments', async () => {
  for (const value of [
    'smoke-email-token',
    'POST /api/v1/shares/private-share-token/download-ticket 200',
    'GET /api/v1/storage/objects/private%2Fobject-key 200',
    'PUT /api/v1/storage/uploads/private%2Fupload-key/parts/7 200',
    'POST /api/v1/storage/uploads/private-complete-key/complete 200',
  ]) {
    const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-route-secret-'))
    await mkdir(join(root, 'compose'), { recursive: true })
    await writeFile(join(root, 'compose', 'logs.txt'), `${value}\n`)
    await assert.rejects(() => assertSafeArtifactTree(root), /sensitive/)
  }
})

test('artifact tree rejects credential-bearing API paths hidden in base64 and base64url', async () => {
  const routes = [
    Buffer.from('/api/v1/shares/private-share-token/download-ticket').toString('base64url'),
    Buffer.from('/api/v1/storage/uploads/private%2Fupload-key/parts/7').toString('base64'),
    Buffer.from('/api/v1/storage/uploads/private-complete-key/complete').toString('base64url'),
  ]
  for (const route of routes) {
    const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-route-encoded-'))
    await mkdir(join(root, 'playwright-report'), { recursive: true })
    await writeFile(join(root, 'playwright-report', 'results.json'), JSON.stringify({ route }))
    await assert.rejects(() => assertSafeArtifactTree(root), /encoded sensitive text/)
  }
})

test('artifact tree permits public publication slugs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-publication-'))
  await mkdir(join(root, 'compose'), { recursive: true })
  await writeFile(join(root, 'compose', 'logs.txt'), 'POST /api/v1/publications/public-release-notes/download-ticket 200\n')
  await assertSafeArtifactTree(root)
})

test('artifact report allowlist rejects opaque HTML and JavaScript bundles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-opaque-'))
  await mkdir(join(root, 'playwright-report'), { recursive: true })
  await writeFile(join(root, 'playwright-report', 'index.html'), '<script src="bundle.js"></script>')
  await assert.rejects(() => assertSafeArtifactTree(root), /not allowlisted/)
})
