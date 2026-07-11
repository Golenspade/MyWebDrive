import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { Prisma, type PrismaClient } from '@prisma/client'

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

type SessionStore = Pick<PrismaClient, 'refreshSession'>
type RandomBytes = (size: number) => Buffer

export class InvalidRefreshSessionError extends Error {
  constructor() {
    super('invalid refresh session')
  }
}

export type CreatedRefreshSession = {
  sessionId: string
  familyId: string
  token: string
  absoluteExpiresAt: Date
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function createOpaqueToken(sessionId: string, randomBytes: RandomBytes): string {
  return `${sessionId}.${randomBytes(32).toString('base64url')}`
}

function parseToken(token: string): { sessionId: string; tokenHash: string } | null {
  const match = /^([^.]+)\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match?.[1]) return null
  return { sessionId: match[1], tokenHash: hashToken(token) }
}

function hashesEqual(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex')
  const right = Buffer.from(rightHex, 'hex')
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right)
}

export async function createRefreshSession(
  store: SessionStore,
  userId: string,
  now: Date,
  randomBytes: RandomBytes,
): Promise<CreatedRefreshSession> {
  const sessionId = randomUUID()
  const familyId = randomUUID()
  const token = createOpaqueToken(sessionId, randomBytes)
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS)

  await store.refreshSession.create({
    data: {
      id: sessionId,
      familyId,
      userId,
      tokenHash: hashToken(token),
      idleExpiresAt: absoluteExpiresAt,
      absoluteExpiresAt,
      createdAt: now,
      lastUsedAt: now,
    },
  })

  return { sessionId, familyId, token, absoluteExpiresAt }
}

type RotatedRefreshSession = CreatedRefreshSession & {
  user: { id: string; email: string; role: string }
}

function isRetryableTransaction(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

export async function rotateRefreshSession(
  prisma: PrismaClient,
  token: string,
  now: Date,
  randomBytes: RandomBytes,
): Promise<RotatedRefreshSession> {
  const parsed = parseToken(token)
  if (!parsed) throw new InvalidRefreshSessionError()

  const replacementId = randomUUID()
  const replacementToken = createOpaqueToken(replacementId, randomBytes)

  for (let transactionAttempt = 0; transactionAttempt < 3; transactionAttempt += 1) {
    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          const current = await tx.refreshSession.findUnique({
            where: { id: parsed.sessionId },
            include: { user: { select: { id: true, email: true, role: true } } },
          })
          if (!current || !hashesEqual(current.tokenHash, parsed.tokenHash)) {
            return { kind: 'invalid' } as const
          }
          if (current.rotatedAt) {
            await tx.refreshSession.updateMany({
              where: { familyId: current.familyId },
              data: { revokedAt: now },
            })
            return { kind: 'reused' } as const
          }
          if (
            current.revokedAt ||
            current.idleExpiresAt <= now ||
            current.absoluteExpiresAt <= now
          ) {
            return { kind: 'invalid' } as const
          }

          const idleDeadline = new Date(
            Math.min(now.getTime() + SESSION_LIFETIME_MS, current.absoluteExpiresAt.getTime()),
          )
          const rotated = await tx.refreshSession.updateMany({
            where: {
              id: current.id,
              rotatedAt: null,
              revokedAt: null,
              idleExpiresAt: { gt: now },
              absoluteExpiresAt: { gt: now },
            },
            data: { rotatedAt: now, replacedById: replacementId, lastUsedAt: now },
          })
          if (rotated.count !== 1) {
            const latest = await tx.refreshSession.findUnique({ where: { id: current.id } })
            if (latest?.rotatedAt) {
              await tx.refreshSession.updateMany({
                where: { familyId: current.familyId },
                data: { revokedAt: now },
              })
              return { kind: 'reused' } as const
            }
            return { kind: 'invalid' } as const
          }

          await tx.refreshSession.create({
            data: {
              id: replacementId,
              familyId: current.familyId,
              userId: current.userId,
              tokenHash: hashToken(replacementToken),
              idleExpiresAt: idleDeadline,
              absoluteExpiresAt: current.absoluteExpiresAt,
              createdAt: now,
              lastUsedAt: now,
            },
          })

          return {
            kind: 'rotated',
            session: {
              sessionId: replacementId,
              familyId: current.familyId,
              token: replacementToken,
              absoluteExpiresAt: current.absoluteExpiresAt,
              user: current.user,
            },
          } as const
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      if (outcome.kind === 'rotated') return outcome.session
      throw new InvalidRefreshSessionError()
    } catch (error) {
      if (isRetryableTransaction(error) && transactionAttempt < 2) continue
      throw error
    }
  }
  throw new InvalidRefreshSessionError()
}

export async function revokeRefreshSession(
  prisma: PrismaClient,
  token: string,
  now: Date,
): Promise<void> {
  const parsed = parseToken(token)
  if (!parsed) return
  await prisma.refreshSession.updateMany({
    where: { id: parsed.sessionId, tokenHash: parsed.tokenHash, revokedAt: null },
    data: { revokedAt: now },
  })
}
