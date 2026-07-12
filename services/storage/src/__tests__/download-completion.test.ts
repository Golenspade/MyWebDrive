import { createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createConnection } from 'node:net'
import { Readable } from 'node:stream'

import express from 'express'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createStorageApi } from '../api.js'
import type { ObjectStorage } from '../object-storage/types.js'

const secret = 'download-completion-secret-at-least-32-bytes'
const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const attemptId = '126b455f-b9e7-49b9-aab6-4cb1ff971328'
const fileVersionId = '16232aef-1f26-4bb4-98ba-ccc72d7f3915'
const now = new Date('2026-07-12T12:00:00.000Z')

function token(expectedBytes = 5n): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'storage-grant' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    aud: 'storage-api',
    purpose: 'download-private',
    objectKey,
    downloadAttemptId: attemptId,
    fileVersionId,
    expectedBytes: expectedBytes.toString(),
    jti: randomUUID(),
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(now.getTime() / 1000) + 60,
  })).toString('base64url')
  const input = `${header}.${payload}`
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`
}

function dependencies(body: () => Readable = () => Readable.from('hello')) {
  const order: string[] = []
  const storage: ObjectStorage = {
    writePart: vi.fn(),
    completeObject: vi.fn(),
    openRead: vi.fn(async () => {
      order.push('open')
      return body()
    }),
    stat: vi.fn(async () => {
      order.push('stat')
      return { sizeBytes: 5n }
    }),
    deleteObject: vi.fn(),
    deletePart: vi.fn(),
    deleteParts: vi.fn(),
    inspectParts: vi.fn(),
    ready: vi.fn(async () => undefined),
  }
  const redis = {
    ping: vi.fn(async () => 'PONG'),
    set: vi.fn(async (): Promise<'OK' | null> => {
      order.push('consume')
      return 'OK' as const
    }),
  }
  const downloadEvents = {
    appendStarted: vi.fn(async () => {
      order.push('started')
      return '171-0'
    }),
    appendCompleted: vi.fn(async () => {
      order.push('completed')
      return '172-0'
    }),
  }
  const queue = {
    reservePart: vi.fn(), commitPart: vi.fn(), releasePart: vi.fn(), freezeAndEnqueue: vi.fn(),
  }
  return { storage, redis, downloadEvents, queue, order }
}

function app(
  deps: ReturnType<typeof dependencies>,
  beforeRouter?: express.RequestHandler,
) {
  const application = express()
  if (beforeRouter) application.use(beforeRouter)
  return application.use(createStorageApi({ ...deps, grantSecret: secret, now: () => now }))
}

describe('durable successful-download boundary', () => {
  test('persists started before the first byte and completed only after response finish', async () => {
    const deps = dependencies(() => new Readable({
      read() {
        deps.order.push('first-byte')
        this.push('hello')
        this.push(null)
      },
    }))
    const response = await request(app(deps, (_req, res, next) => {
      res.once('finish', () => deps.order.push('finish'))
      next()
    }))
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(200)
    expect(response.body).toEqual(Buffer.from('hello'))
    expect(response.headers['content-length']).toBe('5')
    await vi.waitFor(() => expect(deps.downloadEvents.appendCompleted).toHaveBeenCalledOnce())
    expect(deps.order).toEqual([
      'stat', 'consume', 'open', 'started', 'first-byte', 'finish', 'completed',
    ])
    expect(deps.downloadEvents.appendStarted).toHaveBeenCalledWith({
      attemptId, fileVersionId, expectedBytes: 5n, occurredAt: now,
    })
    expect(deps.downloadEvents.appendCompleted).toHaveBeenCalledWith({
      attemptId, fileVersionId, bytes: 5n, occurredAt: now,
    })
  })

  test('rejects an object-size mismatch before consuming the grant or starting transfer', async () => {
    const deps = dependencies()
    vi.mocked(deps.storage.stat).mockResolvedValueOnce({ sizeBytes: 4n })
    await request(app(deps))
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(409, { error: 'object size mismatch' })
    expect(deps.redis.set).not.toHaveBeenCalled()
    expect(deps.storage.openRead).not.toHaveBeenCalled()
    expect(deps.downloadEvents.appendStarted).not.toHaveBeenCalled()
  })

  test('fails closed before the first byte when started persistence fails', async () => {
    const deps = dependencies()
    deps.downloadEvents.appendStarted.mockRejectedValueOnce(new Error('redis unavailable'))
    await request(app(deps))
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(503, { error: 'download tracking unavailable' })
    expect(deps.downloadEvents.appendCompleted).not.toHaveBeenCalled()
  })

  test('rejects replay before appending either download fact', async () => {
    const deps = dependencies()
    deps.redis.set.mockResolvedValueOnce(null)
    await request(app(deps))
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token()}`)
      .expect(401, { error: 'unauthorized' })
    expect(deps.downloadEvents.appendStarted).not.toHaveBeenCalled()
    expect(deps.downloadEvents.appendCompleted).not.toHaveBeenCalled()
  })

  test('never appends completion when the source ends with the wrong byte count', async () => {
    const deps = dependencies(() => Readable.from('hell'))
    await expect(request(app(deps))
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token()}`))
      .rejects.toThrow()
    expect(deps.downloadEvents.appendStarted).toHaveBeenCalledOnce()
    expect(deps.downloadEvents.appendCompleted).not.toHaveBeenCalled()
  })

  test('keeps started pending without recording success when completion persistence fails', async () => {
    const deps = dependencies()
    deps.downloadEvents.appendCompleted.mockRejectedValueOnce(new Error('redis unavailable'))
    const response = await request(app(deps))
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(200)
    expect(response.body).toEqual(Buffer.from('hello'))
    expect(deps.downloadEvents.appendStarted).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(deps.downloadEvents.appendCompleted).toHaveBeenCalledOnce())
  })

  test('does not append completion after the client aborts', async () => {
    let pushRest: (() => void) | undefined
    const deps = dependencies(() => new Readable({
      read() {
        if (pushRest) return
        this.push('he')
        pushRest = () => {
          this.push('llo')
          this.push(null)
        }
      },
    }))
    const server = app(deps).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing test address')
    const socket = createConnection({ host: '127.0.0.1', port: address.port })
    socket.on('error', () => undefined)
    await once(socket, 'connect')
    socket.write(
      `GET /api/v1/storage/objects/${objectKey} HTTP/1.1\r\n` +
      `Host: 127.0.0.1\r\nAuthorization: Bearer ${token()}\r\nConnection: close\r\n\r\n`,
    )
    await once(socket, 'data')
    socket.destroy()
    try {
      await new Promise((resolve) => setTimeout(resolve, 25))
      pushRest?.()
      expect(deps.downloadEvents.appendStarted).toHaveBeenCalledOnce()
      expect(deps.downloadEvents.appendCompleted).not.toHaveBeenCalled()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('does not begin a deferred completion XADD when close wins before finish', async () => {
    let releaseEnd: (() => void) | undefined
    let resolveXadd: (() => void) | undefined
    const deps = dependencies()
    deps.downloadEvents.appendCompleted.mockImplementationOnce(() => new Promise<string>((resolve) => {
      resolveXadd = () => resolve('172-0')
    }))
    const server = app(deps, (_req, res, next) => {
      const originalEnd = res.end.bind(res)
      res.end = ((chunk?: unknown, encoding?: BufferEncoding, callback?: () => void) => {
        releaseEnd = () => {
          originalEnd(chunk as never, encoding as never, callback)
        }
        return res
      }) as typeof res.end
      next()
    }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing test address')
    const socket = createConnection({ host: '127.0.0.1', port: address.port })
    socket.on('error', () => undefined)
    await once(socket, 'connect')
    socket.write(
      `GET /api/v1/storage/objects/${objectKey} HTTP/1.1\r\n` +
      `Host: 127.0.0.1\r\nAuthorization: Bearer ${token()}\r\nConnection: close\r\n\r\n`,
    )
    await once(socket, 'data')
    await vi.waitFor(() => {
      expect(releaseEnd !== undefined || deps.downloadEvents.appendCompleted.mock.calls.length > 0)
        .toBe(true)
    })
    socket.destroy()
    resolveXadd?.()
    try {
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(deps.downloadEvents.appendCompleted).not.toHaveBeenCalled()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test('cleans a backpressure drain wait when the response closes', async () => {
    let response: express.Response | undefined
    const deps = dependencies()
    const server = app(deps, (_req, res, next) => {
      response = res
      const originalWrite = res.write.bind(res)
      res.write = ((chunk: unknown, encoding?: BufferEncoding, callback?: (error?: Error | null) => void) => {
        originalWrite(chunk as never, encoding as never, callback)
        return false
      }) as typeof res.write
      next()
    }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing test address')
    const socket = createConnection({ host: '127.0.0.1', port: address.port })
    socket.on('error', () => undefined)
    await once(socket, 'connect')
    socket.write(
      `GET /api/v1/storage/objects/${objectKey} HTTP/1.1\r\n` +
      `Host: 127.0.0.1\r\nAuthorization: Bearer ${token()}\r\nConnection: close\r\n\r\n`,
    )
    await once(socket, 'data')
    socket.destroy()
    try {
      await new Promise((resolve) => setTimeout(resolve, 25))
      expect(response?.listenerCount('drain')).toBe(0)
      expect(deps.downloadEvents.appendCompleted).not.toHaveBeenCalled()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
