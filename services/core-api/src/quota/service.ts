import { Prisma, type PrismaClient } from '@prisma/client'

const EXPIRY_RELEASE_BATCH_SIZE = 50
const MAX_TRANSACTION_ATTEMPTS = 5

type TransactionClient = Prisma.TransactionClient

export type QuotaBalance = {
  limitBytes: bigint
  reservedBytes: bigint
  committedBytes: bigint
}

export class QuotaNotFoundError extends Error {}
export class QuotaLimitConflictError extends Error {}
export class QuotaInvariantError extends Error {}

function retryable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code === 'P2034') return true
  return error.code === 'P2010' && error.meta?.code === '40001'
}

export async function runSerializable<T>(
  prisma: PrismaClient,
  operation: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (retryable(error) && attempt < MAX_TRANSACTION_ATTEMPTS - 1) continue
      throw error
    }
  }
  throw new QuotaInvariantError()
}

export function serializeQuota(balance: QuotaBalance): {
  limitBytes: string
  reservedBytes: string
  committedBytes: string
  availableBytes: string
} {
  return {
    limitBytes: balance.limitBytes.toString(),
    reservedBytes: balance.reservedBytes.toString(),
    committedBytes: balance.committedBytes.toString(),
    availableBytes: (
      balance.limitBytes -
      balance.reservedBytes -
      balance.committedBytes
    ).toString(),
  }
}

export async function releaseExpiredReservations(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<number> {
  let totalReleased = 0
  for (;;) {
    const batch = await runSerializable(prisma, async (tx) => {
      const candidates = await tx.quotaReservation.findMany({
        where: { userId, status: 'reserved', expiresAt: { lte: now } },
        orderBy: { expiresAt: 'asc' },
        take: EXPIRY_RELEASE_BATCH_SIZE,
        select: { id: true, uploadIntentId: true, bytes: true },
      })
      let released = 0
      for (const candidate of candidates) {
        const transitioned = await tx.quotaReservation.updateMany({
          where: { id: candidate.id, userId, status: 'reserved', expiresAt: { lte: now } },
          data: { status: 'expired' },
        })
        if (transitioned.count !== 1) continue

        const debited = await tx.quotaAccount.updateMany({
          where: { userId, reservedBytes: { gte: candidate.bytes } },
          data: { reservedBytes: { decrement: candidate.bytes } },
        })
        if (debited.count !== 1) throw new QuotaInvariantError()
        await tx.quotaLedgerEntry.create({
          data: {
            userId,
            businessRef: `reservation-release:${candidate.id}`,
            kind: 'reservation_expired',
            deltaBytes: -candidate.bytes,
          },
        })
        await tx.uploadIntent.updateMany({
          where: {
            id: candidate.uploadIntentId,
            userId,
            status: { in: ['created', 'uploading', 'finalizing'] },
          },
          data: { status: 'expired' },
        })
        released += 1
      }
      return { candidateCount: candidates.length, released }
    })
    totalReleased += batch.released
    if (batch.candidateCount < EXPIRY_RELEASE_BATCH_SIZE) return totalReleased
    // A full batch can have more rows behind it even when a competing replica
    // wins some conditional transitions. Query again with the same fixed cutoff.
  }
}

export async function getQuotaBalance(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<QuotaBalance> {
  await releaseExpiredReservations(prisma, userId, now)
  const account = await prisma.quotaAccount.findUnique({
    where: { userId },
    select: { limitBytes: true, reservedBytes: true, committedBytes: true },
  })
  if (!account) throw new QuotaNotFoundError()
  return account
}

export async function setQuotaLimit(
  prisma: PrismaClient,
  userId: string,
  limitBytes: bigint,
): Promise<QuotaBalance> {
  return runSerializable(prisma, async (tx) => {
    const updated = await tx.$queryRaw<QuotaBalance[]>(Prisma.sql`
      UPDATE "QuotaAccount"
      SET "limitBytes" = ${limitBytes}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId}
        AND "reservedBytes" + "committedBytes" <= ${limitBytes}
      RETURNING "limitBytes", "reservedBytes", "committedBytes"
    `)
    if (updated[0]) return updated[0]

    const existing = await tx.quotaAccount.findUnique({
      where: { userId },
      select: { userId: true },
    })
    if (!existing) throw new QuotaNotFoundError()
    throw new QuotaLimitConflictError()
  })
}
