import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import test from 'node:test'

async function unusedPort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address === 'object')
  const port = address.port
  server.close()
  await once(server, 'close')
  return port
}

async function waitUntilReady(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${url}/healthz`)
      if (response.ok) return
    } catch {
      // The child may not have bound the socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('fake email did not become ready')
}

test('mailboxes are recipient scoped and require the test-only token', async (t) => {
  const port = await unusedPort()
  const baseUrl = `http://127.0.0.1:${port}`
  const providerToken = 'provider-test-token'
  const mailboxToken = 'mailbox-test-token'
  const child = spawn(process.execPath, ['scripts/smoke/fake-email/server.mjs'], {
    cwd: new URL('../../..', import.meta.url),
    env: {
      ...process.env,
      EMAIL_PROVIDER_PORT: String(port),
      EMAIL_PROVIDER_TOKEN: providerToken,
      FAKE_EMAIL_TEST_TOKEN: mailboxToken,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(() => child.kill('SIGTERM'))
  await waitUntilReady(baseUrl)

  for (const [to, code] of [
    ['healthy-admin@example.test', '123456'],
    ['degraded-admin@example.test', '654321'],
  ]) {
    const response = await fetch(`${baseUrl}/v1/messages/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, code, ttlSeconds: 600, purpose: 'login' }),
    })
    assert.equal(response.status, 204)
  }

  const unauthorized = await fetch(
    `${baseUrl}/v1/test/mailboxes/latest?recipient=healthy-admin%40example.test`,
  )
  assert.equal(unauthorized.status, 401)

  const first = await fetch(
    `${baseUrl}/v1/test/mailboxes/latest?recipient=healthy-admin%40example.test`,
    { headers: { 'X-Test-Mailbox-Token': mailboxToken } },
  )
  assert.equal(first.status, 200)
  assert.deepEqual(await first.json(), {
    to: 'healthy-admin@example.test',
    code: '123456',
    ttlSeconds: 600,
    purpose: 'login',
  })

  const second = await fetch(
    `${baseUrl}/v1/test/mailboxes/latest?recipient=degraded-admin%40example.test`,
    { headers: { 'X-Test-Mailbox-Token': mailboxToken } },
  )
  assert.equal(second.status, 200)
  assert.equal((await second.json()).code, '654321')

  const unknown = await fetch(
    `${baseUrl}/v1/test/mailboxes/latest?recipient=missing%40example.test`,
    { headers: { 'X-Test-Mailbox-Token': mailboxToken } },
  )
  assert.equal(unknown.status, 404)
})
