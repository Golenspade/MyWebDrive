import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { Prisma, type PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'

import type { EmailSender } from './email-sender.js'
import { normalizeEmail } from './email.js'
import { createRefreshSession } from './session.js'

export { normalizeEmail } from './email.js'

const OTP_TTL_MS = 10 * 60 * 1000
const RATE_LIMIT_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then
  return {-1, -1}
end
local emailCount = redis.call('INCR', KEYS[1])
if emailCount == 1 then redis.call('EXPIRE', KEYS[1], 3700) end
local ipCount = redis.call('INCR', KEYS[2])
if ipCount == 1 then redis.call('EXPIRE', KEYS[2], 3700) end
if emailCount <= 5 and ipCount <= 20 then
  redis.call('SET', KEYS[3], '1', 'EX', 60)
end
return {emailCount, ipCount}
`

type RandomBytes = (size: number) => Buffer

export class OtpRateLimitError extends Error {}
export class OtpInfrastructureError extends Error {}
export class OtpDeliveryError extends Error {}
export class InvalidOtpError extends Error {}
export class OtpAttemptsExhaustedError extends Error {}

export function createOtpDigest(
  pepper: string,
  challengeId: string,
  email: string,
  code: string,
): Buffer {
  return createHmac('sha256', pepper)
    .update(challengeId)
    .update('\0')
    .update(email)
    .update('\0')
    .update(code)
    .digest()
}

export function otpDigestsEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right)
}

export function generateOtpCode(randomBytes: RandomBytes): string {
  const acceptanceLimit = 16_000_000
  for (;;) {
    const sample = randomBytes(3)
    if (sample.length !== 3) throw new Error('randomBytes returned the wrong size')
    const value = sample.readUIntBE(0, 3)
    if (value < acceptanceLimit) return String(value % 1_000_000).padStart(6, '0')
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function utcHour(now: Date): string {
  return now.toISOString().slice(0, 13)
}

export async function requestEmailOtp(input: {
  prisma: PrismaClient
  redis: Redis
  emailSender: EmailSender
  email: string
  ip: string
  now: Date
  randomBytes: RandomBytes
  pepper: string
}): Promise<{ challengeId: string }> {
  const email = normalizeEmail(input.email)
  const emailHash = sha256(email)
  const ipHash = sha256(input.ip)
  const hour = utcHour(input.now)
  let counts: unknown
  try {
    counts = await input.redis.eval(
      RATE_LIMIT_SCRIPT,
      3,
      `otp:email:${emailHash}:${hour}`,
      `otp:ip:${ipHash}:${hour}`,
      `otp:cooldown:${emailHash}`,
    )
  } catch {
    throw new OtpInfrastructureError()
  }
  if (
    !Array.isArray(counts) ||
    counts.length !== 2 ||
    counts.some((count) => typeof count !== 'number')
  ) {
    throw new OtpInfrastructureError()
  }
  const [emailCount, ipCount] = counts as [number, number]
  if (emailCount < 0 || ipCount < 0 || emailCount > 5 || ipCount > 20) {
    throw new OtpRateLimitError()
  }

  const challengeId = randomUUID()
  const code = generateOtpCode(input.randomBytes)
  await input.prisma.emailOtpChallenge.create({
    data: {
      id: challengeId,
      email,
      codeDigest: createOtpDigest(input.pepper, challengeId, email, code).toString('hex'),
      expiresAt: new Date(input.now.getTime() + OTP_TTL_MS),
      requestedIpHash: ipHash,
    },
  })

  try {
    await input.emailSender.sendOtp({ to: email, code, ttlSeconds: 600, purpose: 'login' })
    await input.prisma.emailOtpChallenge.update({
      where: { id: challengeId },
      data: { deliveryStatus: 'sent' },
    })
  } catch {
    await input.prisma.emailOtpChallenge.update({
      where: { id: challengeId },
      data: { deliveryStatus: 'failed' },
    })
    throw new OtpDeliveryError()
  }

  return { challengeId }
}

function isRetryableTransaction(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
}

export async function verifyEmailOtp(input: {
  prisma: PrismaClient
  challengeId: string
  email: string
  code: string
  now: Date
  pepper: string
  adminEmails: ReadonlySet<string>
  randomBytes: RandomBytes
}): Promise<{
  user: { id: string; email: string; role: string }
  refreshToken: string
}> {
  const email = normalizeEmail(input.email)

  for (let transactionAttempt = 0; transactionAttempt < 3; transactionAttempt += 1) {
    try {
      const outcome = await input.prisma.$transaction(
        async (tx) => {
          const challenge = await tx.emailOtpChallenge.findUnique({
            where: { id: input.challengeId },
          })
          if (!challenge) return { kind: 'invalid' } as const
          if (challenge.failedAttempts >= 5) return { kind: 'exhausted' } as const
          if (
            challenge.email !== email ||
            challenge.deliveryStatus !== 'sent' ||
            challenge.consumedAt ||
            challenge.expiresAt <= input.now
          ) {
            return { kind: 'invalid' } as const
          }

          const presentedDigest = createOtpDigest(
            input.pepper,
            challenge.id,
            email,
            input.code,
          )
          const storedDigest = Buffer.from(challenge.codeDigest, 'hex')
          if (!otpDigestsEqual(storedDigest, presentedDigest)) {
            const incremented = await tx.emailOtpChallenge.updateMany({
              where: {
                id: challenge.id,
                consumedAt: null,
                expiresAt: { gt: input.now },
                failedAttempts: { lt: 5 },
              },
              data: { failedAttempts: { increment: 1 } },
            })
            if (incremented.count !== 1) return { kind: 'invalid' } as const
            return {
              kind: challenge.failedAttempts + 1 >= 5 ? 'exhausted' : 'invalid',
            } as const
          }

          const consumed = await tx.emailOtpChallenge.updateMany({
            where: {
              id: challenge.id,
              consumedAt: null,
              expiresAt: { gt: input.now },
              failedAttempts: { lt: 5 },
            },
            data: { consumedAt: input.now },
          })
          if (consumed.count !== 1) return { kind: 'invalid' } as const

          const user = await tx.user.upsert({
            where: { email },
            create: { email, role: input.adminEmails.has(email) ? 'admin' : 'user' },
            update: {},
            select: { id: true, email: true, role: true },
          })
          const session = await createRefreshSession(tx, user.id, input.now, input.randomBytes)
          return { kind: 'verified', user, refreshToken: session.token } as const
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )

      if (outcome.kind === 'verified') return outcome
      if (outcome.kind === 'exhausted') throw new OtpAttemptsExhaustedError()
      throw new InvalidOtpError()
    } catch (error) {
      if (isRetryableTransaction(error) && transactionAttempt < 2) continue
      throw error
    }
  }
  throw new InvalidOtpError()
}
