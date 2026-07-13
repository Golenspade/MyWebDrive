import { createServer } from 'node:http'

let lastMessage = null
const configuredPort = Number.parseInt(process.env.EMAIL_PROVIDER_PORT ?? '8025', 10)
const port = Number.isFinite(configuredPort) && configuredPort > 0 && configuredPort <= 65535 ? configuredPort : 8025
const providerToken = process.env.EMAIL_PROVIDER_TOKEN ?? 'smoke-email-token'

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end('{"status":"ok"}')
    return
  }
  if (request.method === 'GET' && request.url === '/last') {
    response.writeHead(lastMessage ? 200 : 404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(lastMessage ?? { error: 'empty' }))
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
      lastMessage = body
      response.writeHead(204).end()
    } catch {
      response.writeHead(400).end()
    }
  })
})

server.listen(port, '0.0.0.0')
