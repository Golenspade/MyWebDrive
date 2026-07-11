import express from 'express'
import { Transform, type TransformCallback } from 'node:stream'

import { verifyStorageGrant } from './grants/verifier.js'
import type { ObjectStorage } from './object-storage/types.js'

type GrantRedis = {
  ping(): Promise<unknown>
  set(key: string, value: string, expiryMode: 'EX', ttl: number, condition: 'NX'): Promise<'OK' | null>
}

type CompletionQueue = {
  enqueueOnce(input: { uploadIntentId: string; objectKey: string; parts: number }): Promise<{
    enqueued: boolean
    id: string
  }>
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
    if (contentLength && /^\d+$/.test(contentLength) && BigInt(contentLength) > grant.maxBytes) {
      return res.status(413).json({ error: 'payload too large' })
    }
    try {
      const limiter = new ByteLimit(grant.maxBytes)
      req.pipe(limiter)
      await deps.storage.writePart(grant.objectKey, partNumber, limiter)
      return res.status(204).end()
    } catch (error) {
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
        const inspected = await deps.storage.inspectParts(grant.objectKey, parts)
        if (!inspected.complete) return res.status(409).json({ error: 'missing upload part' })
        if (inspected.sizeBytes < 1n || inspected.sizeBytes > grant.maxBytes) {
          return res.status(413).json({ error: 'payload too large' })
        }
        const queued = await deps.queue.enqueueOnce({
          uploadIntentId: grant.uploadIntentId,
          objectKey: grant.objectKey,
          parts,
        })
        return res.status(202).json({ enqueued: queued.enqueued })
      } catch {
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
