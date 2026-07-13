import { createServer } from 'node:http'

const mailboxes = new Map()
const configuredPort = Number.parseInt(process.env.EMAIL_PROVIDER_PORT ?? '8025', 10)
const port = Number.isFinite(configuredPort) && configuredPort > 0 && configuredPort <= 65535 ? configuredPort : 8025
const providerToken = process.env.EMAIL_PROVIDER_TOKEN ?? 'smoke-email-token'
const testToken = process.env.FAKE_EMAIL_TEST_TOKEN ?? ''

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end('{"status":"ok"}')
    return
  }
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (request.method === 'GET' && url.pathname === '/v1/test/mailboxes/latest') {
    if (!testToken || request.headers['x-test-mailbox-token'] !== testToken) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end('{"error":"unauthorized"}')
      return
    }
    const recipient = url.searchParams.get('recipient')?.trim().toLowerCase()
    if (!recipient) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end('{"error":"recipient_required"}')
      return
    }
    const message = mailboxes.get(recipient)
    response.writeHead(message ? 200 : 404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(message ?? { error: 'empty' }))
    return
  }
  if (request.method !== 'POST' || request.url !== '/v1/messages/otp') {
    response.writeHead(404).end()
    return
  }

  const chunks = []
  let size = 0
  request.on('data', (chunk) => {
    size += chunk.length
    if (size > 4096) request.destroy()
    else chunks.push(chunk)
  })
  request.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (
        request.headers.authorization !== `Bearer ${providerToken}` ||
        typeof body.to !== 'string' ||
        !/^\d{6}$/.test(body.code) ||
        body.ttlSeconds !== 600 ||
        body.purpose !== 'login'
      ) {
        response.writeHead(400).end()
        return
      }
      const recipient = body.to.trim().toLowerCase()
      mailboxes.set(recipient, { ...body, to: recipient })
      response.writeHead(204).end()
    } catch {
      response.writeHead(400).end()
    }
  })
})

server.listen(port, '0.0.0.0')
