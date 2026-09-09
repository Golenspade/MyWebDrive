import { randomUUID } from 'node:crypto'

import { Prisma, type PrismaClient } from '@prisma/client'

import {
  QuotaLimitConflictError,
  QuotaNotFoundError,
  runSerializable,
  type QuotaBalance,
} from './service.js'

export const ROLE_WEIGHTS = {
  user: 1n,
  superuser: 3n,
  admin: 8n,
} as const

export class QuotaPoolExceededError extends Error {}

export type PoolMember = {
  userId: string
  role: string
  status: string
  committedBytes: bigint
  reservedBytes: bigint
  limitBytes: bigint
}

export type PoolAllocation = {
  userId: string
  previousLimitBytes: bigint
  occupiedBytes: bigint
  limitBytes: bigint
}

export type PoolPlan = {
  overcommitted: boolean
  poolBytes: bigint
  platformReserveBytes: bigint
  occupiedBytes: bigint
  allocableBytes: bigint
  allocations: PoolAllocation[]
}

export type QuotaPoolConfig = {
  poolBytes: bigint
  platformReserveBytes: bigint
}

type TransactionClient = Prisma.TransactionClient

function roleWeight(role: string): bigint {
  if (role === 'admin') return ROLE_WEIGHTS.admin
  if (role === 'superuser') return ROLE_WEIGHTS.superuser
  return ROLE_WEIGHTS.user
}

function occupiedBytes(member: Pick<PoolMember, 'committedBytes' | 'reservedBytes'>): bigint {
  return member.committedBytes + member.reservedBytes
}

export function planPoolAllocation(
  members: readonly PoolMember[],
  poolBytes: bigint,
  platformReserveBytes: bigint,
): PoolPlan {
  const occupiedTotal = members.reduce((sum, member) => sum + occupiedBytes(member), 0n)
  const allocableBytes = poolBytes - platformReserveBytes - occupiedTotal
  const active = members.filter((member) => member.status === 'active')
  const overcommitted = allocableBytes < 0n

  if (active.length === 0) {
    return {
      overcommitted,
      poolBytes,
      platformReserveBytes,
      occupiedBytes: occupiedTotal,
      allocableBytes,
      allocations: [],
    }
  }

  if (overcommitted) {
    return {
      overcommitted: true,
      poolBytes,
      platformReserveBytes,
      occupiedBytes: occupiedTotal,
      allocableBytes,
      allocations: active.map((member) => {
        const occupied = occupiedBytes(member)
        return {
          userId: member.userId,
          previousLimitBytes: member.limitBytes,
          occupiedBytes: occupied,
          limitBytes: occupied,
        }
      }),
    }
  }

  const weights = active.map((member) => roleWeight(member.role))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n)
  const floors = weights.map((weight) => (allocableBytes * weight) / totalWeight)
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (allocableBytes * weight) % totalWeight,
    userId: active[index]!.userId,
  }))
  remainders.sort((left, right) => {
    if (right.remainder !== left.remainder) return right.remainder > left.remainder ? 1 : -1
    return left.userId < right.userId ? -1 : left.userId > right.userId ? 1 : 0
  })

  let leftover = allocableBytes - floors.reduce((sum, share) => sum + share, 0n)
  const extras = new Array<bigint>(active.length).fill(0n)
  for (const item of remainders) {
    if (leftover <= 0n) break
    extras[item.index] = 1n
    leftover -= 1n
  }

  return {
    overcommitted: false,
    poolBytes,
    platformReserveBytes,
    occupiedBytes: occupiedTotal,
    allocableBytes,
    allocations: active.map((member, index) => {
      const occupied = occupiedBytes(member)
      return {
        userId: member.userId,
        previousLimitBytes: member.limitBytes,
        occupiedBytes: occupied,
        limitBytes: occupied + floors[index]! + extras[index]!,
      }
    }),
  }
}

async function loadMembers(tx: TransactionClient): Promise<PoolMember[]> {
  const users = await tx.user.findMany({
    select: {
      id: true,
      role: true,
      status: true,
      quotaAccount: {
        select: { limitBytes: true, reservedBytes: true, committedBytes: true },
      },
    },
  })
  return users.flatMap((user) => {
    if (!user.quotaAccount) return []
    return [
      {
        userId: user.id,
        role: user.role,
        status: user.status,
        committedBytes: user.quotaAccount.committedBytes,
        reservedBytes: user.quotaAccount.reservedBytes,
        limitBytes: user.quotaAccount.limitBytes,
      },
    ]
  })
}

export async function previewQuotaPool(
  prisma: PrismaClient,
  config: QuotaPoolConfig,
): Promise<PoolPlan> {
  const members = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      status: true,
      quotaAccount: {
        select: { limitBytes: true, reservedBytes: true, committedBytes: true },
      },
    },
  })
  return planPoolAllocation(
    members.flatMap((user) =>
      user.quotaAccount
        ? [
            {
              userId: user.id,
              role: user.role,
              status: user.status,
              committedBytes: user.quotaAccount.committedBytes,
              reservedBytes: user.quotaAccount.reservedBytes,
              limitBytes: user.quotaAccount.limitBytes,
            },
          ]
        : [],
    ),
    config.poolBytes,
    config.platformReserveBytes,
  )
}

export async function rebalanceQuotaPool(
  prisma: PrismaClient,
  now: Date,
  config: QuotaPoolConfig,
): Promise<PoolPlan> {
  const runId = randomUUID()
  return runSerializable(prisma, async (tx) => {
    const expired = await tx.quotaReservation.findMany({
      where: { status: 'reserved', expiresAt: { lte: now } },
      select: { id: true, userId: true, uploadIntentId: true, bytes: true },
    })
    for (const reservation of expired) {
      const transitioned = await tx.quotaReservation.updateMany({
        where: { id: reservation.id, status: 'reserved', expiresAt: { lte: now } },
        data: { status: 'expired' },
      })
      if (transitioned.count !== 1) continue
      const debited = await tx.quotaAccount.updateMany({
        where: { userId: reservation.userId, reservedBytes: { gte: reservation.bytes } },
        data: { reservedBytes: { decrement: reservation.bytes } },
      })
      if (debited.count !== 1) continue
      await tx.uploadIntent.updateMany({
        where: {
          id: reservation.uploadIntentId,
          status: { in: ['created', 'uploading', 'finalizing'] },
        },
        data: { status: 'expired' },
      })
    }

    const plan = planPoolAllocation(await loadMembers(tx), config.poolBytes, config.platformReserveBytes)
    for (const allocation of plan.allocations) {
      await tx.quotaAccount.update({
        where: { userId: allocation.userId },
        data: { limitBytes: allocation.limitBytes },
      })
      await tx.quotaLedgerEntry.create({
        data: {
          userId: allocation.userId,
          businessRef: `pool-rebalance:${runId}:${allocation.userId}`,
          kind: 'pool_rebalance',
          deltaBytes: allocation.limitBytes - allocation.previousLimitBytes,
        },
      })
    }
    return plan
  })
}

export async function setQuotaLimitWithinPool(
  prisma: PrismaClient,
  userId: string,
  limitBytes: bigint,
  config: QuotaPoolConfig,
): Promise<QuotaBalance> {
  return runSerializable(prisma, async (tx) => {
    const accounts = await tx.quotaAccount.findMany({
      select: { userId: true, limitBytes: true },
    })
    if (!accounts.some((account) => account.userId === userId)) {
      throw new QuotaNotFoundError()
    }
    const nextSum = accounts.reduce(
      (sum, account) => sum + (account.userId === userId ? limitBytes : account.limitBytes),
      0n,
    )
    if (nextSum > config.poolBytes - config.platformReserveBytes) {
      throw new QuotaPoolExceededError()
    }
    const updated = await tx.$queryRaw<QuotaBalance[]>(Prisma.sql`
      UPDATE "QuotaAccount"
      SET "limitBytes" = ${limitBytes}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId}
        AND "reservedBytes" + "committedBytes" <= ${limitBytes}
      RETURNING "limitBytes", "reservedBytes", "committedBytes"
    `)
    if (updated[0]) return updated[0]
    throw new QuotaLimitConflictError()
  })
}
