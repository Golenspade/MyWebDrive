import type { PrismaClient } from '@prisma/client'
import express from 'express'

import { verifyCompletionCallback } from '../uploads/service.js'

const PURPOSES = new Set(['private', 'share', 'publication'] as const)
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n

type DownloadPurpose = 'private' | 'share' | 'publication'

export class DownloadAttemptNotFoundError extends Error {}
export class DownloadAttemptNotStartedYetError extends Error {}
export class DownloadAttemptConflictError extends Error {}

export async function createDownloadAttempt(input: {
  prisma: PrismaClient
  fileVersionId: string
  purpose: DownloadPurpose
  expectedBytes: bigint
  now: Date
}) {
  if (!PURPOSES.has(input.purpose) || input.expectedBytes < 0n) {
    throw new DownloadAttemptConflictError()
  }
  return input.prisma.downloadAttempt.create({
    data: {
      fileVersionId: input.fileVersionId,
      purpose: input.purpose,
      expectedBytes: input.expectedBytes,
      issuedAt: input.now,
    },
  })
}

export async function recordDownloadStarted(input: {
  prisma: PrismaClient
  attemptId: string
  fileVersionId: string
  expectedBytes: bigint
  occurredAt: Date
}) {
  const changed = await input.prisma.downloadAttempt.updateMany({
    where: {
      id: input.attemptId,
      fileVersionId: input.fileVersionId,
      expectedBytes: input.expectedBytes,
      status: 'issued',
    },
    data: { status: 'started', startedAt: input.occurredAt },
  })
  if (changed.count === 1) {
    return { id: input.attemptId, status: 'started' as const, startedAt: input.occurredAt, idempotent: false }
  }

  const existing = await input.prisma.downloadAttempt.findUnique({
    where: { id: input.attemptId },
  })
  if (!existing) throw new DownloadAttemptNotFoundError()
  if (
    existing.fileVersionId !== input.fileVersionId ||
    existing.expectedBytes !== input.expectedBytes ||
    !existing.startedAt ||
    existing.startedAt.getTime() !== input.occurredAt.getTime() ||
    !['started', 'completed'].includes(existing.status)
  ) {
    throw new DownloadAttemptConflictError()
  }
  return {
    id: existing.id,
    status: existing.status as 'started' | 'completed',
    startedAt: existing.startedAt,
    idempotent: true,
  }
}

export async function recordDownloadCompleted(input: {
  prisma: PrismaClient
  attemptId: string
  fileVersionId: string
  bytes: bigint
  occurredAt: Date
}) {
  return input.prisma.$transaction(async (tx) => {
    const existing = await tx.downloadAttempt.findUnique({
      where: { id: input.attemptId },
    })
    if (!existing) throw new DownloadAttemptNotFoundError()
    if (
      existing.fileVersionId !== input.fileVersionId ||
      existing.expectedBytes !== input.bytes ||
      input.occurredAt < existing.issuedAt
    ) {
      throw new DownloadAttemptConflictError()
    }
    if (existing.status === 'completed') {
      if (existing.completedAt?.getTime() !== input.occurredAt.getTime()) {
        throw new DownloadAttemptConflictError()
      }
      return {
        id: existing.id,
        status: 'completed' as const,
        completedAt: existing.completedAt,
        idempotent: true,
      }
    }
    if (existing.status === 'issued') {
      throw new DownloadAttemptNotStartedYetError()
    }
    if (
      existing.status !== 'started' ||
      !existing.startedAt ||
      input.occurredAt < existing.startedAt
    ) {
      throw new DownloadAttemptConflictError()
    }

    const changed = await tx.downloadAttempt.updateMany({
      where: { id: input.attemptId, status: 'started' },
      data: { status: 'completed', completedAt: input.occurredAt },
    })
    if (changed.count !== 1) {
      const accepted = await tx.downloadAttempt.findUnique({
        where: { id: input.attemptId },
      })
      if (
        accepted?.status === 'completed' &&
        accepted.fileVersionId === input.fileVersionId &&
        accepted.expectedBytes === input.bytes &&
        accepted.completedAt?.getTime() === input.occurredAt.getTime()
      ) {
        return {
          id: accepted.id,
          status: 'completed' as const,
          completedAt: accepted.completedAt,
          idempotent: true,
        }
      }
      throw new DownloadAttemptConflictError()
    }
    await tx.outboxEvent.create({
      data: {
        dedupeKey: `download.completed:${existing.id}`,
        topic: 'download.completed',
        aggregateId: existing.id,
        occurredAt: input.occurredAt,
        payload: {
          downloadAttemptId: existing.id,
          fileVersionId: existing.fileVersionId,
          sizeBytes: input.bytes.toString(),
        },
      },
    })
    return {
      id: existing.id,
      status: 'completed' as const,
      completedAt: input.occurredAt,
      idempotent: false,
    }
  })
}

export async function markStaleDownloadAttemptsUnknown(input: {
  prisma: PrismaClient
  startedBefore: Date
  now: Date
}): Promise<number> {
  return input.prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      WITH transitioned AS (
        UPDATE "DownloadAttempt"
        SET
          "status" = 'unknown',
          "unknownAt" = ${input.now}
        WHERE "status" = 'started'
          AND "startedAt" <= ${input.startedBefore}
        RETURNING "startedAt"
      ), gap AS (
        SELECT
          COUNT(*)::bigint AS "count",
          MIN("startedAt") AS "gapStartedAt"
        FROM transitioned
      ), coverage AS (
        INSERT INTO "AnalyticsCoverage" (
          "metric",
          "startedAt",
          "complete",
          "gapStartedAt",
          "updatedAt"
        )
        SELECT
          'downloads',
          gap."gapStartedAt",
          FALSE,
          gap."gapStartedAt",
          ${input.now}
        FROM gap
        WHERE gap."count" > 0
        ON CONFLICT ("metric") DO UPDATE SET
          "startedAt" = LEAST(
            "AnalyticsCoverage"."startedAt",
            EXCLUDED."startedAt"
          ),
          "complete" = FALSE,
          "gapStartedAt" = CASE
            WHEN "AnalyticsCoverage"."gapStartedAt" IS NULL
              THEN EXCLUDED."gapStartedAt"
            ELSE LEAST(
              "AnalyticsCoverage"."gapStartedAt",
              EXCLUDED."gapStartedAt"
            )
          END,
          "updatedAt" = EXCLUDED."updatedAt"
        RETURNING "metric"
      )
      SELECT gap."count"
      FROM gap
      LEFT JOIN coverage ON TRUE
      LIMIT 1
    `
    return Number(rows[0]?.count ?? 0n)
  })
}

function parseEventBody(
  rawBody: Buffer | undefined,
  phase: 'started' | 'completed',
): {
  fileVersionId: string
  bytes: bigint
  occurredAt: Date
} {
  if (!rawBody) throw new Error('invalid download callback')
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody.toString('utf8'))
  } catch {
    throw new Error('invalid download callback')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('invalid download callback')
  }
  const body = parsed as Record<string, unknown>
  const byteKey = phase === 'started' ? 'expectedBytes' : 'bytes'
  const expectedKeys = ['fileVersionId', byteKey, 'occurredAt'].sort()
  if (
    JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(expectedKeys) ||
    typeof body.fileVersionId !== 'string' ||
    !UUID_PATTERN.test(body.fileVersionId) ||
    typeof body[byteKey] !== 'string' ||
    !/^(0|[1-9]\d*)$/.test(body[byteKey]) ||
    typeof body.occurredAt !== 'string'
  ) {
    throw new Error('invalid download callback')
  }
  const bytes = BigInt(body[byteKey])
  const occurredAt = new Date(body.occurredAt)
  if (
    bytes > MAX_DATABASE_BIGINT ||
    !Number.isFinite(occurredAt.getTime()) ||
    occurredAt.toISOString() !== body.occurredAt
  ) {
    throw new Error('invalid download callback')
  }
  return { fileVersionId: body.fileVersionId, bytes, occurredAt }
}

export function createDownloadAttemptCallbackRouter(input: {
  prisma: PrismaClient
  callbackSecret: string
  now: () => Date
}): express.Router {
  const router = express.Router()
  router.post('/internal/download-attempts/:id/:phase', async (req, res, next) => {
    const phase = req.params.phase
    if (
      !UUID_PATTERN.test(req.params.id ?? '') ||
      (phase !== 'started' && phase !== 'completed')
    ) {
      return next()
    }
    try {
      verifyCompletionCallback({
        timestamp: req.headers['x-core-timestamp'],
        signature: req.headers['x-core-signature'],
        rawBody: req.rawBody,
        secret: input.callbackSecret,
        now: input.now(),
      })
    } catch {
      return res.status(401).json({ error: 'invalid callback identity' })
    }

    let event
    try {
      event = parseEventBody(req.rawBody, phase)
    } catch {
      return res.status(400).json({ error: 'invalid download callback' })
    }
    try {
      const result = phase === 'started'
        ? await recordDownloadStarted({
            prisma: input.prisma,
            attemptId: req.params.id,
            fileVersionId: event.fileVersionId,
            expectedBytes: event.bytes,
            occurredAt: event.occurredAt,
          })
        : await recordDownloadCompleted({
            prisma: input.prisma,
            attemptId: req.params.id,
            fileVersionId: event.fileVersionId,
            bytes: event.bytes,
            occurredAt: event.occurredAt,
          })
      return res.json({ id: result.id, status: result.status, idempotent: result.idempotent })
    } catch (error) {
      if (error instanceof DownloadAttemptNotFoundError) {
        return res.status(404).json({ error: 'download attempt not found' })
      }
      if (error instanceof DownloadAttemptNotStartedYetError) {
        return res.status(425).json({ error: 'download attempt not started yet' })
      }
      if (error instanceof DownloadAttemptConflictError) {
        return res.status(409).json({ error: 'download attempt conflict' })
      }
      return res.status(503).json({ error: 'service unavailable' })
    }
  })
  return router
}
