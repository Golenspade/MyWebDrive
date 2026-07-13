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
recipient=user@real.invalid code=123456
fixture=healthy-admin@example.test status=partial
`)
  assert.doesNotMatch(redacted, /secret|header\.payload|private\/key|123456|smoke-mailbox|user@real\.invalid/)
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
  await writeFile(join(root, 'playwright-report', 'index.html'), '<title>safe report</title>')
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
