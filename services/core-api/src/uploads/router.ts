import type { PrismaClient } from '@prisma/client'
import express from 'express'

import { createAccessMiddleware, requireAdmin } from '../auth/middleware.js'
import { issueStorageGrant } from '../grants/storage-grant.js'
import {
  getQuotaBalance,
  QuotaLimitConflictError,
  QuotaNotFoundError,
  serializeQuota,
  setQuotaLimit,
} from '../quota/service.js'
import {
  cancelUploadIntent,
  createUploadIntent,
  IdempotencyConflictError,
  InvalidParentFolderError,
  InvalidUploadIntentError,
  parseUploadIntent,
  QuotaExceededError,
  UploadIntentNotFoundError,
  UploadIntentStateConflictError,
  completeUploadIntent,
  CompletionConflictError,
  InvalidCompletionBodyError,
  InvalidCompletionCallbackError,
  InvalidTargetFileError,
  LiveSiblingNameConflictError,
  parseCompletionBody,
  parseReplacementUploadIntent,
  verifyCompletionCallback,
} from './service.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n

type UploadRouterDependencies = {
  prisma: PrismaClient
  now: () => Date
  sessionSecret: string
  grantSecret: string
  callbackSecret: string
  uploadMetrics: {
    recordSuccess(durationMs: number): void
    recordFailure(durationMs: number): void
  }
}

function parseNonnegativeBigInt(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new InvalidUploadIntentError()
  }
  const parsed = BigInt(value)
  if (parsed > MAX_DATABASE_BIGINT) throw new InvalidUploadIntentError()
  return parsed
}

export function createUploadRouter(deps: UploadRouterDependencies): express.Router {
  const router = express.Router()
  const requireAccess = createAccessMiddleware({
    prisma: deps.prisma,
    sessionSecret: deps.sessionSecret,
  })

  async function respondWithIntent(
    res: express.Response,
    input: { userId: string; parsed: ReturnType<typeof parseUploadIntent> },
  ) {
    const result = await createUploadIntent({
      prisma: deps.prisma,
      userId: input.userId,
      request: input.parsed,
      now: deps.now(),
    })
    const grantNow = deps.now()
    const uploadGrant = issueStorageGrant({
      purpose: 'upload',
      objectKey: result.intent.objectKey,
      uploadIntentId: result.intent.id,
      maxBytes: result.intent.sizeBytes,
      now: grantNow,
      expiresAt: result.intent.expiresAt,
      secret: deps.grantSecret,
    })
    return res.status(result.created ? 201 : 200).json({
      id: result.intent.id,
      objectKey: result.intent.objectKey,
      uploadGrant,
      expiresAt: result.intent.expiresAt.toISOString(),
    })
  }

  function uploadError(error: unknown, res: express.Response) {
    if (error instanceof IdempotencyConflictError) {
      return res.status(409).json({ error: 'idempotency key conflict' })
    }
    if (error instanceof QuotaExceededError) {
      return res.status(413).json({ error: 'quota exceeded' })
    }
    if (error instanceof InvalidParentFolderError) {
      return res.status(400).json({ error: 'invalid upload intent' })
    }
    if (error instanceof InvalidTargetFileError) {
      return res.status(404).json({ error: 'file not found' })
    }
    if (error instanceof UploadIntentStateConflictError) {
      return res.status(409).json({ error: 'upload intent is not active' })
    }
    return res.status(503).json({ error: 'service unavailable' })
  }

  router.post('/files/:fileId/upload-intents', requireAccess, async (req, res) => {
    let parsed
    try {
      parsed = parseReplacementUploadIntent({
        idempotencyKey: req.headers['idempotency-key'],
        fileId: req.params.fileId,
        body: req.body,
      })
    } catch {
      return res.status(400).json({ error: 'invalid upload intent' })
    }
    try {
      return await respondWithIntent(res, { userId: req.authUser!.id, parsed })
    } catch (error) {
      return uploadError(error, res)
    }
  })

  router.post('/upload-intents', requireAccess, async (req, res) => {
    let parsed
    try {
      parsed = parseUploadIntent({
        idempotencyKey: req.headers['idempotency-key'],
        body: req.body,
      })
    } catch {
      return res.status(400).json({ error: 'invalid upload intent' })
    }

    try {
      return await respondWithIntent(res, { userId: req.authUser!.id, parsed })
    } catch (error) {
      return uploadError(error, res)
    }
  })

  router.post('/internal/upload-intents/:id/complete', async (req, res, next) => {
    if (!UUID_PATTERN.test(req.params.id ?? '')) {
      return next()
    }
    try {
      verifyCompletionCallback({
        timestamp: req.headers['x-core-timestamp'],
        signature: req.headers['x-core-signature'],
        rawBody: req.rawBody,
        secret: deps.callbackSecret,
        now: deps.now(),
      })
    } catch (error) {
      if (error instanceof InvalidCompletionCallbackError) {
        return res.status(401).json({ error: 'invalid callback identity' })
      }
      return res.status(401).json({ error: 'invalid callback identity' })
    }
    let completion
    try {
      completion = parseCompletionBody(req.rawBody)
    } catch (error) {
      if (error instanceof InvalidCompletionBodyError) {
        return res.status(400).json({ error: 'invalid completion' })
      }
      return res.status(400).json({ error: 'invalid completion' })
    }
    const startedAt = performance.now()
    try {
      const result = await completeUploadIntent({
        prisma: deps.prisma,
        intentId: req.params.id,
        completion,
        now: deps.now(),
      })
      deps.uploadMetrics.recordSuccess(performance.now() - startedAt)
      return res.json(result)
    } catch (error) {
      deps.uploadMetrics.recordFailure(performance.now() - startedAt)
      if (error instanceof UploadIntentNotFoundError) {
        return res.status(404).json({ error: 'upload intent not found' })
      }
      if (
        error instanceof CompletionConflictError ||
        error instanceof UploadIntentStateConflictError ||
        error instanceof InvalidTargetFileError ||
        error instanceof InvalidParentFolderError ||
        error instanceof LiveSiblingNameConflictError
      ) {
        return res.status(409).json({ error: 'upload completion conflict' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.post('/upload-intents/:id/cancel', requireAccess, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.id ?? '')) {
      return res.status(404).json({ error: 'upload intent not found' })
    }
    try {
      await cancelUploadIntent({
        prisma: deps.prisma,
        userId: req.authUser!.id,
        intentId: req.params.id,
        now: deps.now(),
      })
      return res.status(204).end()
    } catch (error) {
      if (error instanceof UploadIntentNotFoundError) {
        return res.status(404).json({ error: 'upload intent not found' })
      }
      if (error instanceof UploadIntentStateConflictError) {
        return res.status(409).json({ error: 'upload intent is not active' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.get('/quota', requireAccess, async (req, res) => {
    try {
      const quota = await getQuotaBalance(deps.prisma, req.authUser!.id, deps.now())
      return res.json(serializeQuota(quota))
    } catch {
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  router.patch('/admin/users/:userId/quota', requireAccess, requireAdmin, async (req, res) => {
    if (!UUID_PATTERN.test(req.params.userId ?? '')) {
      return res.status(404).json({ error: 'user not found' })
    }
    let limitBytes: bigint
    try {
      limitBytes = parseNonnegativeBigInt(req.body?.limitBytes)
    } catch {
      return res.status(400).json({ error: 'invalid quota limit' })
    }

    try {
      const quota = await setQuotaLimit(deps.prisma, req.params.userId, limitBytes)
      return res.json(serializeQuota(quota))
    } catch (error) {
      if (error instanceof QuotaLimitConflictError) {
        return res.status(409).json({ error: 'quota limit below current usage' })
      }
      if (error instanceof QuotaNotFoundError) {
        return res.status(404).json({ error: 'user not found' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })

  return router
}
