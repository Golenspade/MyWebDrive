import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'

import { Prisma, type PrismaClient, type UploadIntent } from '@prisma/client'

import {
  QuotaInvariantError,
  QuotaNotFoundError,
  isSerializableConflict,
  releaseExpiredReservations,
  runSerializable as runQuotaSerializable,
} from '../quota/service.js'
import { enqueueFileVersionCreated } from '../outbox/service.js'

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
export class InvalidTargetFileError extends Error {}
export class InvalidCompletionCallbackError extends Error {}
export class InvalidCompletionBodyError extends Error {}
export class CompletionConflictError extends Error {}
export class LiveSiblingNameConflictError extends Error {}

const MAX_COMPLETION_OUTER_ATTEMPTS = 4

export type ValidatedUploadIntent = {
  idempotencyKey: string
  fileName: string
  sizeBytes: bigint
  mimeType: string
  parentId: string | null
  targetFileId: string | null
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
    targetFileId: null,
  }
}

export function parseReplacementUploadIntent(input: {
  idempotencyKey: unknown
  fileId: unknown
  body: unknown
}): ValidatedUploadIntent {
  if (typeof input.fileId !== 'string' || !UUID_PATTERN.test(input.fileId)) {
    throw new InvalidUploadIntentError()
  }
  const parsed = parseUploadIntent({
    idempotencyKey: input.idempotencyKey,
    body:
      typeof input.body === 'object' && input.body !== null
        ? { ...input.body, fileName: '_replacement_', parentId: null }
        : input.body,
  })
  return { ...parsed, targetFileId: input.fileId }
}

function sameRequest(existing: UploadIntent, input: ValidatedUploadIntent): boolean {
  if (input.targetFileId !== null) {
    return (
      existing.idempotencyKey === input.idempotencyKey &&
      existing.targetFileId === input.targetFileId &&
      existing.sizeBytes === input.sizeBytes &&
      existing.mimeType === input.mimeType
    )
  }
  return (
    existing.idempotencyKey === input.idempotencyKey &&
    existing.fileName === input.fileName &&
    existing.sizeBytes === input.sizeBytes &&
    existing.mimeType === input.mimeType &&
    existing.parentId === input.parentId &&
    existing.targetFileId === null
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
      const target = input.request.targetFileId
        ? await tx.file.findFirst({
            where: {
              id: input.request.targetFileId,
              ownerId: input.userId,
              type: 'file',
              deletedAt: null,
            },
            select: { name: true, parentId: true },
          })
        : null
      if (input.request.targetFileId && !target) throw new InvalidTargetFileError()

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

      let fileName = input.request.fileName
      let parentId = input.request.parentId
      if (target) {
        fileName = target.name
        parentId = target.parentId
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
          fileName,
          targetFileId: input.request.targetFileId,
          sizeBytes: input.request.sizeBytes,
          mimeType: input.request.mimeType,
          parentId,
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

const CALLBACK_MAX_SKEW_MS = 300_000
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const OBJECT_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/

export type CompletionBody = {
  objectKey: string
  sizeBytes: bigint
  sha256: string
}

export type CompletionResult = {
  fileId: string
  versionId: string
  idempotent: boolean
}

export function verifyCompletionCallback(input: {
  timestamp: unknown
  signature: unknown
  rawBody: Buffer | undefined
  secret: string
  now: Date
}): void {
  if (
    typeof input.timestamp !== 'string' ||
    !/^\d{10}$/.test(input.timestamp) ||
    typeof input.signature !== 'string' ||
    !SHA256_PATTERN.test(input.signature) ||
    !input.rawBody
  ) {
    throw new InvalidCompletionCallbackError()
  }
  const timestampMs = Number(input.timestamp) * 1000
  if (!Number.isSafeInteger(timestampMs) || Math.abs(input.now.getTime() - timestampMs) > CALLBACK_MAX_SKEW_MS) {
    throw new InvalidCompletionCallbackError()
  }
  const expected = createHmac('sha256', input.secret)
    .update(`${input.timestamp}.`)
    .update(input.rawBody)
    .digest()
  const supplied = Buffer.from(input.signature, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    throw new InvalidCompletionCallbackError()
  }
}

export function parseCompletionBody(rawBody: Buffer | undefined): CompletionBody {
  if (!rawBody) throw new InvalidCompletionBodyError()
  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    throw new InvalidCompletionBodyError()
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidCompletionBodyError()
  }
  const value = body as Record<string, unknown>
  if (
    typeof value.objectKey !== 'string' ||
    !OBJECT_KEY_PATTERN.test(value.objectKey) ||
    typeof value.sizeBytes !== 'string' ||
    !/^[1-9]\d*$/.test(value.sizeBytes) ||
    typeof value.sha256 !== 'string' ||
    !SHA256_PATTERN.test(value.sha256)
  ) {
    throw new InvalidCompletionBodyError()
  }
  const sizeBytes = BigInt(value.sizeBytes)
  if (sizeBytes > MAX_DATABASE_BIGINT) throw new InvalidCompletionBodyError()
  return { objectKey: value.objectKey, sizeBytes, sha256: value.sha256 }
}

function sameCompletion(
  version: { objectKey: string; sizeBytes: bigint; sha256: string },
  completion: CompletionBody,
): boolean {
  return (
    version.objectKey === completion.objectKey &&
    version.sizeBytes === completion.sizeBytes &&
    version.sha256 === completion.sha256
  )
}

export async function completeUploadIntent(input: {
  prisma: PrismaClient
  intentId: string
  completion: CompletionBody
  now: Date
}): Promise<CompletionResult> {
  for (let attempt = 0; attempt < MAX_COMPLETION_OUTER_ATTEMPTS; attempt += 1) {
    try {
      return await runQuotaSerializable(input.prisma, async (tx) => {
      const existingVersion = await tx.fileVersion.findUnique({
        where: { uploadIntentId: input.intentId },
        select: { id: true, fileId: true, objectKey: true, sizeBytes: true, sha256: true },
      })
      if (existingVersion) {
        if (!sameCompletion(existingVersion, input.completion)) {
          throw new CompletionConflictError()
        }
        return { fileId: existingVersion.fileId, versionId: existingVersion.id, idempotent: true }
      }

      const intent = await tx.uploadIntent.findUnique({
        where: { id: input.intentId },
        include: { reservation: true },
      })
      if (!intent || !intent.reservation) throw new UploadIntentNotFoundError()
      if (
        intent.objectKey !== input.completion.objectKey ||
        intent.sizeBytes !== input.completion.sizeBytes
      ) {
        throw new CompletionConflictError()
      }
      if (
        !['created', 'uploading', 'finalizing'].includes(intent.status) ||
        intent.expiresAt <= input.now ||
        intent.reservation.status !== 'reserved'
      ) {
        throw new UploadIntentStateConflictError()
      }

      let fileId: string
      let versionNumber: number
      if (intent.targetFileId) {
        const target = await tx.file.findFirst({
          where: { id: intent.targetFileId, ownerId: intent.userId, type: 'file', deletedAt: null },
          select: { id: true },
        })
        if (!target) throw new InvalidTargetFileError()
        fileId = target.id
        const latest = await tx.fileVersion.aggregate({
          where: { fileId },
          _max: { version: true },
        })
        versionNumber = (latest._max.version ?? 0) + 1
      } else {
        if (intent.parentId) {
          const parent = await tx.file.findFirst({
            where: {
              id: intent.parentId,
              ownerId: intent.userId,
              type: 'folder',
              deletedAt: null,
            },
            select: { id: true },
          })
          if (!parent) throw new InvalidParentFolderError()
        }
        const file = await tx.file.create({
          data: {
            ownerId: intent.userId,
            parentId: intent.parentId,
            name: intent.fileName,
            type: 'file',
          },
          select: { id: true },
        })
        fileId = file.id
        versionNumber = 1
      }

      const reservation = await tx.quotaReservation.updateMany({
        where: { id: intent.reservation.id, status: 'reserved' },
        data: { status: 'committed' },
      })
      if (reservation.count !== 1) throw new UploadIntentStateConflictError()
      const account = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        UPDATE "QuotaAccount"
        SET "reservedBytes" = "reservedBytes" - ${intent.sizeBytes},
            "committedBytes" = "committedBytes" + ${intent.sizeBytes},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${intent.userId}
          AND "reservedBytes" >= ${intent.sizeBytes}
          AND "committedBytes" <= "limitBytes" - ${intent.sizeBytes}
        RETURNING "userId"
      `)
      if (!account[0]) throw new QuotaInvariantError()

      const version = await tx.fileVersion.create({
        data: {
          fileId,
          uploadIntentId: intent.id,
          version: versionNumber,
          objectKey: intent.objectKey,
          sizeBytes: intent.sizeBytes,
          mimeType: intent.mimeType,
          sha256: input.completion.sha256,
        },
        select: { id: true },
      })
      if (intent.targetFileId) {
        await tx.file.update({
          where: { id: fileId },
          data: { updatedAt: input.now },
        })
      }
      await tx.quotaLedgerEntry.create({
        data: {
          userId: intent.userId,
          businessRef: `upload-commit:${intent.id}`,
          kind: 'upload_committed',
          deltaBytes: intent.sizeBytes,
        },
      })
      await enqueueFileVersionCreated(tx, {
        fileId,
        versionId: version.id,
        uploadIntentId: intent.id,
        sizeBytes: intent.sizeBytes,
        sha256: input.completion.sha256,
      })
      const transitioned = await tx.uploadIntent.updateMany({
        where: { id: intent.id, status: { in: ['created', 'uploading', 'finalizing'] } },
        data: { status: 'completed', completedAt: input.now },
      })
      if (transitioned.count !== 1) throw new UploadIntentStateConflictError()
      return { fileId, versionId: version.id, idempotent: false }
      })
    } catch (error) {
      const uniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
      if (uniqueConflict || isSerializableConflict(error)) {
        const existingVersion = await input.prisma.fileVersion.findUnique({
          where: { uploadIntentId: input.intentId },
          select: {
            id: true,
            fileId: true,
            objectKey: true,
            sizeBytes: true,
            sha256: true,
          },
        })
        if (existingVersion) {
          if (!sameCompletion(existingVersion, input.completion)) {
            throw new CompletionConflictError()
          }
          return {
            fileId: existingVersion.fileId,
            versionId: existingVersion.id,
            idempotent: true,
          }
        }

        const target = uniqueConflict
          ? JSON.stringify(error.meta?.target ?? '').toLowerCase()
          : ''
        const versionAllocationConflict =
          uniqueConflict && target.includes('fileid') && target.includes('version')
        if (
          (isSerializableConflict(error) || versionAllocationConflict) &&
          attempt < MAX_COMPLETION_OUTER_ATTEMPTS - 1
        ) {
          const baseMs = Math.min(2 ** attempt, 16)
          await new Promise((resolve) =>
            setTimeout(resolve, baseMs + randomInt(0, baseMs + 1)),
          )
          continue
        }
        if (uniqueConflict) throw new LiveSiblingNameConflictError()
      }
      throw error
    }
  }
  throw new UploadIntentStateConflictError()
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
