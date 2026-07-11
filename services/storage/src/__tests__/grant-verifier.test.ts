import { createHmac, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

import express from 'express'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createStorageApi } from '../api.js'
import type { ObjectStorage } from '../object-storage/types.js'

const secret = 'storage-grant-test-secret-at-least-32-bytes'
const objectKey = '5dd0d998-ec26-4fbd-9589-eca8aa9a9311'
const uploadIntentId = '126b455f-b9e7-49b9-aab6-4cb1ff971328'

function token(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'HS256', typ: 'storage-grant' },
  signingSecret = secret,
): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const input = `${encodedHeader}.${encodedPayload}`
  return `${input}.${createHmac('sha256', signingSecret).update(input).digest('base64url')}`
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    aud: 'storage-api',
    typ: undefined,
    purpose: 'download-private',
    objectKey,
    jti: randomUUID(),
    iat: now,
    exp: now + 60,
    ...overrides,
  }
}

function dependencies() {
  const storage: ObjectStorage = {
    writePart: vi.fn(),
    completeObject: vi.fn(),
    openRead: vi.fn(async () => Readable.from('bytes')),
    stat: vi.fn(),
    deleteObject: vi.fn(),
    inspectParts: vi.fn(),
    ready: vi.fn(async () => undefined),
  }
  const redis = {
    ping: vi.fn(async () => 'PONG'),
    set: vi.fn(async (): Promise<'OK' | null> => 'OK'),
    eval: vi.fn(),
  }
  const queue = { enqueueOnce: vi.fn() }
  return { storage, redis, queue }
}

describe('storage API grant boundary', () => {
  test.each([
    ['bad signature', () => token(claims(), undefined, 'wrong-secret-at-least-32-bytes')],
    ['wrong algorithm', () => token(claims(), { alg: 'HS512', typ: 'storage-grant' })],
    ['wrong type', () => token(claims(), { alg: 'HS256', typ: 'JWT' })],
    ['wrong audience', () => token(claims({ aud: 'core-api' }))],
    ['wrong purpose', () => token(claims({ purpose: 'upload' }))],
    ['wrong object', () => token(claims({ objectKey: uploadIntentId }))],
    ['expired', () => token(claims({ iat: 1, exp: 2 }))],
  ])('rejects %s before calling object storage', async (_label, makeToken) => {
    const deps = dependencies()
    const app = express().use(
      createStorageApi({ ...deps, grantSecret: secret, now: () => new Date() }),
    )
    await request(app)
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${makeToken()}`)
      .expect(401)
    expect(deps.storage.openRead).not.toHaveBeenCalled()
  })

  test('consumes a download jti once with atomic SET NX EX and fails closed on replay', async () => {
    const deps = dependencies()
    const grant = token(claims())
    const app = express().use(createStorageApi({ ...deps, grantSecret: secret }))

    const response = await request(app)
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${grant}`)
      .expect(200)
    expect(response.body).toEqual(Buffer.from('bytes'))
    expect(deps.redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^grant:used:/),
      '1',
      'EX',
      expect.any(Number),
      'NX',
    )

    deps.redis.set.mockResolvedValueOnce(null)
    await request(app)
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${grant}`)
      .expect(401)
  })

  test('fails closed on Redis outage without opening the object', async () => {
    const deps = dependencies()
    deps.redis.set.mockRejectedValueOnce(new Error('redis unavailable'))
    const app = express().use(createStorageApi({ ...deps, grantSecret: secret }))
    await request(app)
      .get(`/api/v1/storage/objects/${objectKey}`)
      .set('Authorization', `Bearer ${token(claims())}`)
      .expect(503)
    expect(deps.storage.openRead).not.toHaveBeenCalled()
  })

  test('binds upload intent, object key and maxBytes and enqueues completion once', async () => {
    const deps = dependencies()
    vi.mocked(deps.storage.writePart).mockResolvedValue(undefined)
    vi.mocked(deps.storage.inspectParts).mockResolvedValue({ complete: true, sizeBytes: 5n })
    deps.queue.enqueueOnce.mockResolvedValue({ enqueued: true, id: '1-0' })
    const uploadGrant = token(
      claims({
        purpose: 'upload',
        uploadIntentId,
        maxBytes: '5',
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    )
    const app = express().use(createStorageApi({ ...deps, grantSecret: secret }))

    await request(app)
      .put(`/api/v1/storage/uploads/${objectKey}/parts/1`)
      .set('Authorization', `Bearer ${uploadGrant}`)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('hello'))
      .expect(204)
    await request(app)
      .post(`/api/v1/storage/uploads/${objectKey}/complete`)
      .set('Authorization', `Bearer ${uploadGrant}`)
      .send({ parts: 1 })
      .expect(202)
    expect(deps.queue.enqueueOnce).toHaveBeenCalledWith({ uploadIntentId, objectKey, parts: 1 })
  })
})
