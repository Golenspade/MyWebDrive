import { randomUUID } from 'node:crypto'
import { Transform, type TransformCallback } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import express from 'express'

import { verifyStorageGrant } from './grants/verifier.js'
import type { ObjectStorage } from './object-storage/types.js'

type GrantRedis = {
  ping(): Promise<unknown>
  set(key: string, value: string, expiryMode: 'EX', ttl: number, condition: 'NX'): Promise<'OK' | null>
}

type CompletionQueue = {
  reservePart(input: {
    uploadIntentId: string
    objectKey: string
    partNumber: number
    sizeBytes: bigint
    maxBytes: bigint
    reservationId: string
  }): Promise<'reserved' | 'exists' | 'frozen' | 'too_large' | 'mismatch'>
  commitPart(input: {
    uploadIntentId: string
    partNumber: number
    sizeBytes: bigint
    reservationId: string
  }): Promise<'committed' | 'mismatch'>
  releasePart(input: {
    uploadIntentId: string
    partNumber: number
    sizeBytes: bigint
    reservationId: string
  }): Promise<void>
  freezeAndEnqueue(input: {
    uploadIntentId: string
    objectKey: string
    parts: number
    maxBytes: bigint
    generation: string
  }): Promise<{ enqueued: boolean; id: string; expectedSize: bigint; generation: string }>
}

type ApiDependencies = {
  storage: ObjectStorage
  redis: GrantRedis
  queue: CompletionQueue
  grantSecret: string
  now?: () => Date
}

class PayloadTooLargeError extends Error {}

class ByteLimit extends Transform {
  private seen = 0n

  constructor(private readonly maximum: bigint) {
    super()
  }

  get byteCount(): bigint {
    return this.seen
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.seen += BigInt(chunk.length)
    if (this.seen > this.maximum) return callback(new PayloadTooLargeError())
    callback(null, chunk)
  }
}

function bearer(req: express.Request): string | null {
  const value = req.headers.authorization
  if (!value) return null
  const match = /^Bearer ([^\s]+)$/.exec(value)
  return match?.[1] ?? null
}

function positivePart(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed <= 100_000 ? parsed : null
}

function tokenOr401(req: express.Request, res: express.Response): string | null {
  const value = bearer(req)
  if (!value) res.status(401).json({ error: 'unauthorized' })
  return value
}

export function createStorageApi(deps: ApiDependencies): express.Router {
  const router = express.Router()
  const now = deps.now ?? (() => new Date())

  router.get('/live', (_req, res) => res.json({ status: 'live', service: 'storage-api' }))
  router.get('/ready', async (_req, res) => {
    try {
      await Promise.all([deps.redis.ping(), deps.storage.ready()])
      return res.json({ status: 'ready', service: 'storage-api' })
    } catch {
      return res.status(503).json({ status: 'not_ready', service: 'storage-api' })
    }
  })

  router.put('/api/v1/storage/uploads/:objectKey/parts/:partNumber', async (req, res) => {
    const rawToken = tokenOr401(req, res)
    if (!rawToken) return
    let grant
    try {
      grant = verifyStorageGrant(rawToken, deps.grantSecret, 'upload', now())
      if (grant.purpose !== 'upload' || grant.objectKey !== req.params.objectKey) throw new Error()
    } catch {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const partNumber = positivePart(req.params.partNumber ?? '')
    if (!partNumber) return res.status(400).json({ error: 'invalid part number' })
    const contentLength = req.headers['content-length']
    if (!contentLength || !/^[1-9]\d*$/.test(contentLength)) {
      return res.status(411).json({ error: 'content-length required' })
    }
    const sizeBytes = BigInt(contentLength)
    if (sizeBytes > grant.maxBytes) {
      return res.status(413).json({ error: 'payload too large' })
    }
    const reservationId = randomUUID()
    let reserved = false
    let transferController: AbortController | undefined
    let transferPromise: Promise<void> | undefined
    let persistPromise: Promise<void> | undefined
    try {
      const status = await deps.queue.reservePart({
        uploadIntentId: grant.uploadIntentId,
        objectKey: grant.objectKey,
        partNumber,
        sizeBytes,
        maxBytes: grant.maxBytes,
        reservationId,
      })
      if (status === 'too_large') return res.status(413).json({ error: 'payload too large' })
      if (status !== 'reserved') return res.status(409).json({ error: 'upload generation frozen' })
      reserved = true
      const limiter = new ByteLimit(sizeBytes)
      transferController = new AbortController()
      transferPromise = pipeline(req, limiter, { signal: transferController.signal })
      persistPromise = deps.storage.writePart(grant.objectKey, partNumber, limiter, sizeBytes)
      await Promise.all([transferPromise, persistPromise])
      if (limiter.byteCount !== sizeBytes) throw new Error('content-length mismatch')
      const committed = await deps.queue.commitPart({
        uploadIntentId: grant.uploadIntentId,
        partNumber,
        sizeBytes,
        reservationId,
      })
      if (committed !== 'committed') throw new Error('upload reservation lost')
      return res.status(204).end()
    } catch (error) {
      transferController?.abort()
      if (!req.complete) req.destroy()
      await Promise.allSettled([transferPromise, persistPromise].filter(
        (pending): pending is Promise<void> => pending !== undefined,
      ))
      if (reserved) {
        try {
          await deps.storage.deletePart(grant.objectKey, partNumber)
          await deps.queue.releasePart({
            uploadIntentId: grant.uploadIntentId,
            partNumber,
            sizeBytes,
            reservationId,
          })
        } catch {
          return res.status(503).json({ error: 'upload cleanup unavailable' })
        }
      }
      if (error instanceof PayloadTooLargeError) {
        return res.status(413).json({ error: 'payload too large' })
      }
      return res.status(503).json({ error: 'storage unavailable' })
    }
  })

  router.post(
    '/api/v1/storage/uploads/:objectKey/complete',
    express.json({ limit: '1kb', strict: true }),
    async (req, res) => {
      const rawToken = tokenOr401(req, res)
      if (!rawToken) return
      let grant
      try {
        grant = verifyStorageGrant(rawToken, deps.grantSecret, 'upload', now())
        if (grant.purpose !== 'upload' || grant.objectKey !== req.params.objectKey) throw new Error()
      } catch {
        return res.status(401).json({ error: 'unauthorized' })
      }
      const body = req.body as { parts?: unknown }
      const parts = typeof body?.parts === 'number' ? positivePart(String(body.parts)) : null
      if (!parts) return res.status(400).json({ error: 'invalid parts' })
      try {
        const queued = await deps.queue.freezeAndEnqueue({
          uploadIntentId: grant.uploadIntentId,
          objectKey: grant.objectKey,
          parts,
          maxBytes: grant.maxBytes,
          generation: randomUUID(),
        })
        return res.status(202).json({ enqueued: queued.enqueued })
      } catch (error) {
        if (error instanceof Error && error.message.includes('incomplete')) {
          return res.status(409).json({ error: 'missing upload part' })
        }
        if (error instanceof Error && error.message.includes('size_mismatch')) {
          return res.status(409).json({ error: 'uploaded size mismatch' })
        }
        return res.status(503).json({ error: 'queue unavailable' })
      }
    },
  )

  router.get('/api/v1/storage/objects/:objectKey', async (req, res) => {
    const rawToken = tokenOr401(req, res)
    if (!rawToken) return
    let grant
    try {
      grant = verifyStorageGrant(rawToken, deps.grantSecret, 'download', now())
      if (grant.purpose === 'upload' || grant.objectKey !== req.params.objectKey) throw new Error()
    } catch {
      return res.status(401).json({ error: 'unauthorized' })
    }
    try {
      const ttl = Math.max(1, grant.exp - Math.floor(now().getTime() / 1000))
      const consumed = await deps.redis.set(`grant:used:${grant.jti}`, '1', 'EX', ttl, 'NX')
      if (consumed !== 'OK') return res.status(401).json({ error: 'unauthorized' })
    } catch {
      return res.status(503).json({ error: 'authorization unavailable' })
    }
    try {
      const stream = await deps.storage.openRead(grant.objectKey)
      res.status(200).type('application/octet-stream')
      stream.once('error', () => res.destroy())
      stream.pipe(res)
    } catch {
      return res.status(404).json({ error: 'object not found' })
    }
  })

  return router
}
