import { randomUUID } from 'node:crypto'

import { Prisma, type PrismaClient, type UploadIntent } from '@prisma/client'

import {
  QuotaInvariantError,
  QuotaNotFoundError,
  releaseExpiredReservations,
  runSerializable as runQuotaSerializable,
} from '../quota/service.js'

const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n

export class InvalidUploadIntentError extends Error {}
export class IdempotencyConflictError extends Error {}
export class QuotaExceededError extends Error {}
export class InvalidParentFolderError extends Error {}
export class UploadIntentNotFoundError extends Error {}
export class UploadIntentStateConflictError extends Error {}

export type ValidatedUploadIntent = {
  idempotencyKey: string
  fileName: string
  sizeBytes: bigint
  mimeType: string
  parentId: string | null
}

export type CreatedUploadIntent = {
  intent: UploadIntent
  created: boolean
}

export const runSerializable = runQuotaSerializable

function canonicalPositiveBigInt(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new InvalidUploadIntentError()
  }
  const parsed = BigInt(value)
  if (parsed > MAX_DATABASE_BIGINT) throw new InvalidUploadIntentError()
  return parsed
}

export function parseUploadIntent(input: {
  idempotencyKey: unknown
  body: unknown
}): ValidatedUploadIntent {
  if (
    typeof input.idempotencyKey !== 'string' ||
    !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
  ) {
    throw new InvalidUploadIntentError()
  }
  if (typeof input.body !== 'object' || input.body === null) {
    throw new InvalidUploadIntentError()
  }
  const body = input.body as Record<string, unknown>
  if (typeof body.fileName !== 'string' || body.fileName !== body.fileName.trim()) {
    throw new InvalidUploadIntentError()
  }
  const fileName = body.fileName
  if (
    fileName.length < 1 ||
    fileName.length > 255 ||
    /[\\/\x00-\x1f\x7f]/.test(fileName)
  ) {
    throw new InvalidUploadIntentError()
  }
  if (
    typeof body.mimeType !== 'string' ||
    body.mimeType !== body.mimeType.trim() ||
    body.mimeType.length < 1 ||
    body.mimeType.length > 255 ||
    /[\x00-\x1f\x7f]/.test(body.mimeType)
  ) {
    throw new InvalidUploadIntentError()
  }
  const parentId = body.parentId === undefined ? null : body.parentId
  if (parentId !== null && (typeof parentId !== 'string' || !UUID_PATTERN.test(parentId))) {
    throw new InvalidUploadIntentError()
  }
  return {
    idempotencyKey: input.idempotencyKey,
    fileName,
    sizeBytes: canonicalPositiveBigInt(body.sizeBytes),
    mimeType: body.mimeType,
    parentId,
  }
}

function sameRequest(existing: UploadIntent, input: ValidatedUploadIntent): boolean {
  return (
    existing.idempotencyKey === input.idempotencyKey &&
    existing.fileName === input.fileName &&
    existing.sizeBytes === input.sizeBytes &&
    existing.mimeType === input.mimeType &&
    existing.parentId === input.parentId
  )
}

function existingResult(
  existing: UploadIntent,
  input: ValidatedUploadIntent,
  now: Date,
): CreatedUploadIntent {
  if (!sameRequest(existing, input)) throw new IdempotencyConflictError()
  if (
    existing.expiresAt <= now ||
    !['created', 'uploading', 'finalizing'].includes(existing.status)
  ) {
    throw new UploadIntentStateConflictError()
  }
  return { intent: existing, created: false }
}

export async function createUploadIntent(input: {
  prisma: PrismaClient
  userId: string
  request: ValidatedUploadIntent
  now: Date
}): Promise<CreatedUploadIntent> {
  await releaseExpiredReservations(input.prisma, input.userId, input.now)

  try {
    return await runQuotaSerializable(input.prisma, async (tx) => {
      const existing = await tx.uploadIntent.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.request.idempotencyKey,
          },
        },
      })
      if (existing) return existingResult(existing, input.request, input.now)

      if (input.request.parentId) {
        const parent = await tx.file.findFirst({
          where: {
            id: input.request.parentId,
            ownerId: input.userId,
            type: 'folder',
            deletedAt: null,
          },
          select: { id: true },
        })
        if (!parent) throw new InvalidParentFolderError()
      }

      const reserved = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        UPDATE "QuotaAccount"
        SET "reservedBytes" = "reservedBytes" + ${input.request.sizeBytes},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${input.userId}
          AND ${input.request.sizeBytes} <= "limitBytes" - "committedBytes" - "reservedBytes"
        RETURNING "userId"
      `)
      if (!reserved[0]) {
        const account = await tx.quotaAccount.findUnique({
          where: { userId: input.userId },
          select: { userId: true },
        })
        if (!account) throw new QuotaNotFoundError()
        throw new QuotaExceededError()
      }

      const expiresAt = new Date(input.now.getTime() + UPLOAD_INTENT_TTL_MS)
      const intent = await tx.uploadIntent.create({
        data: {
          userId: input.userId,
          idempotencyKey: input.request.idempotencyKey,
          objectKey: randomUUID(),
          fileName: input.request.fileName,
          sizeBytes: input.request.sizeBytes,
          mimeType: input.request.mimeType,
          parentId: input.request.parentId,
          expiresAt,
        },
      })
      const reservation = await tx.quotaReservation.create({
        data: {
          userId: input.userId,
          uploadIntentId: intent.id,
          bytes: input.request.sizeBytes,
          expiresAt,
        },
      })
      await tx.quotaLedgerEntry.create({
        data: {
          userId: input.userId,
          businessRef: `reservation-create:${reservation.id}`,
          kind: 'reservation_created',
          deltaBytes: input.request.sizeBytes,
        },
      })
      return { intent, created: true }
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await input.prisma.uploadIntent.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.request.idempotencyKey,
          },
        },
      })
      if (existing) return existingResult(existing, input.request, input.now)
    }
    throw error
  }
}

export async function cancelUploadIntent(input: {
  prisma: PrismaClient
  userId: string
  intentId: string
  now: Date
}): Promise<void> {
  await runQuotaSerializable(input.prisma, async (tx) => {
    const intent = await tx.uploadIntent.findFirst({
      where: { id: input.intentId, userId: input.userId },
      include: { reservation: true },
    })
    if (!intent || !intent.reservation) throw new UploadIntentNotFoundError()
    if (['released', 'expired'].includes(intent.reservation.status)) return
    if (intent.reservation.status !== 'reserved') {
      throw new UploadIntentStateConflictError()
    }

    const transitioned = await tx.quotaReservation.updateMany({
      where: { id: intent.reservation.id, userId: input.userId, status: 'reserved' },
      data: { status: 'released' },
    })
    if (transitioned.count !== 1) {
      const latest = await tx.quotaReservation.findUnique({
        where: { id: intent.reservation.id },
        select: { status: true },
      })
      if (latest && ['released', 'expired'].includes(latest.status)) return
      throw new UploadIntentStateConflictError()
    }

    const debited = await tx.quotaAccount.updateMany({
      where: { userId: input.userId, reservedBytes: { gte: intent.reservation.bytes } },
      data: { reservedBytes: { decrement: intent.reservation.bytes } },
    })
    if (debited.count !== 1) throw new QuotaInvariantError()
    await tx.quotaLedgerEntry.create({
      data: {
        userId: input.userId,
        businessRef: `reservation-release:${intent.reservation.id}`,
        kind: 'reservation_released',
        deltaBytes: -intent.reservation.bytes,
      },
    })
    await tx.uploadIntent.updateMany({
      where: {
        id: intent.id,
        userId: input.userId,
        status: { in: ['created', 'uploading', 'finalizing'] },
      },
      data: { status: 'aborted' },
    })
  })
}
