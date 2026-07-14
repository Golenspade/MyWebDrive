import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  assertSafeArtifactTree,
  redactSensitiveText,
} from './verify-smoke-artifacts.mjs'

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
`)
  assert.doesNotMatch(redacted, /secret|header\.payload|private\/key|123456|smoke-(?:mailbox|postgres|redis|minio)|user@real\.invalid/)
  assert.doesNotMatch(redacted, /postgresql:\/\/|redis:\/\//)
  assert.match(redacted, /healthy-admin@example\.test/)
  assert.match(redacted, /status=partial/)
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

test('artifact report allowlist rejects opaque HTML and JavaScript bundles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mwd-artifact-opaque-'))
  await mkdir(join(root, 'playwright-report'), { recursive: true })
  await writeFile(join(root, 'playwright-report', 'index.html'), '<script src="bundle.js"></script>')
  await assert.rejects(() => assertSafeArtifactTree(root), /not allowlisted/)
})
