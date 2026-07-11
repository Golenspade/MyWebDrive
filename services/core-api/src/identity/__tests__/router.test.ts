import { createHash } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies, type SendOtpInput } from '../../app.js'
import { createOtpDigest } from '../otp.js'
import {
  createRefreshSession,
  InvalidRefreshSessionError,
  rotateRefreshSession,
} from '../session.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const redisUrl = process.env.CORE_TEST_REDIS_URL
const integration = describe.runIf(Boolean(databaseUrl && redisUrl))

integration('passwordless identity routes', () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ??
          'postgresql://postgres:postgres@127.0.0.1:5432/mwd_task2?schema=public',
      },
    },
  })
  const redis = new Redis(redisUrl ?? 'redis://127.0.0.1:6379/0', {
    lazyConnect: !redisUrl,
  })
  const now = new Date('2026-07-11T04:00:00.000Z')
  const sent = new Map<string, SendOtpInput>()
  const emailSender = {
    sendOtp: vi.fn(async (input: SendOtpInput) => {
      sent.set(input.to, input)
    }),
  }

  function app(overrides: Partial<CoreDependencies> = {}) {
    return createCoreApp({
      prisma,
      redis,
      emailSender,
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 1),
      identity: {
        sessionSecret: 'identity-test-secret-at-least-32-bytes',
        otpPepper: 'identity-test-otp-pepper',
        adminEmails: 'first-admin@example.test,existing-admin@example.test',
        production: false,
      },
      ...overrides,
    })
  }

  async function requestCode(email: string) {
    const response = await request(app()).post('/api/v1/auth/email/request').send({ email })
    const code = sent.get(email.toLowerCase())?.code
    if (!code) throw new Error('test email sender did not capture an OTP')
    return { response, code }
  }

  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await redis.flushdb()
    await prisma.refreshSession.deleteMany()
    await prisma.emailOtpChallenge.deleteMany()
    await prisma.user.deleteMany()
    sent.clear()
    emailSender.sendOtp.mockClear()
  })

  afterAll(async () => {
    await redis.quit()
    await prisma.$disconnect()
  })

  test('requests and verifies an OTP, sets the hardened cookie, and authenticates me', async () => {
    const email = 'login-user@example.test'
    const { response: requested, code } = await requestCode(email)

    expect(requested.status).toBe(202)
    expect(requested.body).toEqual({
      challengeId: expect.any(String),
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    })

    const verified = await request(app()).post('/api/v1/auth/email/verify').send({
      challengeId: requested.body.challengeId,
      email,
      code,
    })

    expect(verified.status).toBe(200)
    expect(verified.body).toMatchObject({
      accessToken: expect.any(String),
      expiresInSeconds: 900,
      user: { email, role: 'user' },
    })
    expect(verified.headers['set-cookie']?.[0]).toContain('mwd_refresh=')
    expect(verified.headers['set-cookie']?.[0]).toContain('HttpOnly')
    expect(verified.headers['set-cookie']?.[0]).toContain('SameSite=Lax')
    expect(verified.headers['set-cookie']?.[0]).toContain('Path=/api/v1/auth')
    expect(verified.headers['set-cookie']?.[0]).toContain('Max-Age=2592000')

    await request(app())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${verified.body.accessToken}`)
      .expect(200, verified.body.user)
  })

  test('rejects an invalid email before creating a challenge', async () => {
    await request(app()).post('/api/v1/auth/email/request').send({ email: 'not-an-email' }).expect(400)
    expect(await prisma.emailOtpChallenge.count()).toBe(0)
    expect(emailSender.sendOtp).not.toHaveBeenCalled()
  })

  test('marks the refresh cookie Secure in production', async () => {
    const email = 'secure-cookie@example.test'
    const { response: requested, code } = await requestCode(email)
    const productionApp = app({
      identity: {
        sessionSecret: 'identity-test-secret-at-least-32-bytes',
        otpPepper: 'identity-test-otp-pepper',
        adminEmails: '',
        production: true,
      },
    })
    const verified = await request(productionApp).post('/api/v1/auth/email/verify').send({
      challengeId: requested.body.challengeId,
      email,
      code,
    })

    expect(verified.status).toBe(200)
    expect(verified.headers['set-cookie']?.[0]).toContain('Secure')
  })

  test.each(['abcde', '12345', '1234567', '１２３４５６', 123456])(
    'rejects a non-six-ASCII-digit verification code (%s)',
    async (code) => {
      const response = await request(app()).post('/api/v1/auth/email/verify').send({
        challengeId: 'challenge',
        email: 'user@example.test',
        code,
      })
      expect(response.status).toBe(400)
    },
  )

  test('rejects expired challenges after ten minutes', async () => {
    const email = 'expired@example.test'
    const id = 'expired-challenge'
    const code = '123456'
    await prisma.emailOtpChallenge.create({
      data: {
        id,
        email,
        codeDigest: createOtpDigest('identity-test-otp-pepper', id, email, code).toString('hex'),
        expiresAt: new Date(now.getTime() - 1),
        requestedIpHash: 'irrelevant',
        deliveryStatus: 'sent',
      },
    })

    await request(app())
      .post('/api/v1/auth/email/verify')
      .send({ challengeId: id, email, code })
      .expect(401)
  })

  test('the fifth failed attempt locks the challenge', async () => {
    const email = 'attempts@example.test'
    const { response: requested } = await requestCode(email)
    const statuses: number[] = []
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push(
        (
          await request(app()).post('/api/v1/auth/email/verify').send({
            challengeId: requested.body.challengeId,
            email,
            code: '999999',
          })
        ).status,
      )
    }

    expect(statuses).toEqual([401, 401, 401, 401, 429])
    await request(app())
      .post('/api/v1/auth/email/verify')
      .send({ challengeId: requested.body.challengeId, email, code: sent.get(email)?.code })
      .expect(429)
  })

  test('consumes a challenge once and two concurrent verifications create exactly one session', async () => {
    const email = 'concurrent@example.test'
    const { response: requested, code } = await requestCode(email)
    const payload = { challengeId: requested.body.challengeId, email, code }

    const responses = await Promise.all([
      request(app()).post('/api/v1/auth/email/verify').send(payload),
      request(app()).post('/api/v1/auth/email/verify').send(payload),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401])
    expect(await prisma.refreshSession.count()).toBe(1)
  })

  test('rate limits cooldown, email-hour and IP-hour counters in Redis', async () => {
    const email = 'limited@example.test'
    await request(app()).post('/api/v1/auth/email/request').send({ email }).expect(202)
    await request(app()).post('/api/v1/auth/email/request').send({ email }).expect(429)

    const emailHash = await import('node:crypto').then(({ createHash }) =>
      createHash('sha256').update(email).digest('hex'),
    )
    for (let sentCount = 1; sentCount < 5; sentCount += 1) {
      await redis.del(`otp:cooldown:${emailHash}`)
      await request(app()).post('/api/v1/auth/email/request').send({ email }).expect(202)
    }
    await redis.del(`otp:cooldown:${emailHash}`)
    await request(app()).post('/api/v1/auth/email/request').send({ email }).expect(429)

    await redis.flushdb()
    for (let ipCount = 0; ipCount < 20; ipCount += 1) {
      await request(app())
        .post('/api/v1/auth/email/request')
        .send({ email: `ip-limit-${ipCount}@example.test` })
        .expect(202)
    }
    await request(app())
      .post('/api/v1/auth/email/request')
      .send({ email: 'ip-limit-exhausted@example.test' })
      .expect(429)
  })

  test('fails closed when Redis is unavailable', async () => {
    const unavailableRedis = {
      eval: vi.fn(async () => {
        throw new Error('redis unavailable')
      }),
    } as unknown as CoreDependencies['redis']

    await request(app({ redis: unavailableRedis }))
      .post('/api/v1/auth/email/request')
      .send({ email: 'redis-failure@example.test' })
      .expect(503)
    expect(emailSender.sendOtp).not.toHaveBeenCalled()
  })

  test('marks provider failures without exposing provider details', async () => {
    const failingSender = {
      sendOtp: vi.fn(async () => {
        throw new Error('provider response contained secret body')
      }),
    }
    const response = await request(app({ emailSender: failingSender }))
      .post('/api/v1/auth/email/request')
      .send({ email: 'provider-failure@example.test' })

    expect(response.status).toBe(503)
    expect(response.text).not.toContain('provider response contained secret body')
    expect(
      await prisma.emailOtpChallenge.findFirstOrThrow({
        where: { email: 'provider-failure@example.test' },
      }),
    ).toMatchObject({ deliveryStatus: 'failed' })
  })

  test('assigns admin only when an allowlisted email is first created', async () => {
    await prisma.user.create({ data: { email: 'existing-admin@example.test', role: 'user' } })

    for (const [email, role] of [
      ['existing-admin@example.test', 'user'],
      ['first-admin@example.test', 'admin'],
    ] as const) {
      const { response: requested, code } = await requestCode(email)
      const verified = await request(app()).post('/api/v1/auth/email/verify').send({
        challengeId: requested.body.challengeId,
        email,
        code,
      })
      expect(verified.status).toBe(200)
      expect(verified.body.user.role).toBe(role)
    }
  })

  test('stores only the hash of an opaque 32-byte refresh token', async () => {
    const user = await prisma.user.create({ data: { email: 'session-hash@example.test' } })
    const created = await createRefreshSession(prisma, user.id, now, (size) =>
      Buffer.alloc(size, 7),
    )
    const stored = await prisma.refreshSession.findUniqueOrThrow({
      where: { id: created.sessionId },
    })

    expect(created.token).toMatch(/^[^.]+\.[A-Za-z0-9_-]{43}$/)
    expect(stored.tokenHash).toBe(createHash('sha256').update(created.token).digest('hex'))
    expect(stored.tokenHash).not.toContain(created.token)
  })

  test('rotates into the same family and preserves the absolute deadline', async () => {
    const user = await prisma.user.create({ data: { email: 'session-rotate@example.test' } })
    const created = await createRefreshSession(prisma, user.id, now, (size) =>
      Buffer.alloc(size, 8),
    )
    const rotatedAt = new Date('2026-07-12T04:00:00.000Z')
    const rotated = await rotateRefreshSession(prisma, created.token, rotatedAt, (size) =>
      Buffer.alloc(size, 9),
    )
    const rows = await prisma.refreshSession.findMany({
      where: { familyId: created.familyId },
      orderBy: { createdAt: 'asc' },
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]?.rotatedAt).toEqual(rotatedAt)
    expect(rows[0]?.replacedById).toBe(rotated.sessionId)
    expect(rows[1]?.familyId).toBe(rows[0]?.familyId)
    expect(rows[1]?.absoluteExpiresAt).toEqual(rows[0]?.absoluteExpiresAt)
    expect(rows[1]?.idleExpiresAt).toEqual(rows[0]?.absoluteExpiresAt)
  })

  test('reuse revokes every session in the token family', async () => {
    const user = await prisma.user.create({ data: { email: 'session-reuse@example.test' } })
    const created = await createRefreshSession(prisma, user.id, now, (size) =>
      Buffer.alloc(size, 10),
    )
    const rotated = await rotateRefreshSession(
      prisma,
      created.token,
      new Date('2026-07-12T04:00:00.000Z'),
      (size) => Buffer.alloc(size, 11),
    )

    await expect(
      rotateRefreshSession(
        prisma,
        created.token,
        new Date('2026-07-12T05:00:00.000Z'),
        (size) => Buffer.alloc(size, 12),
      ),
    ).rejects.toBeInstanceOf(InvalidRefreshSessionError)

    const rows = await prisma.refreshSession.findMany({
      where: { familyId: rotated.familyId },
    })
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true)
  })

  test('rotates refresh cookies, revokes the family on reuse, and logs out', async () => {
    const email = 'refresh@example.test'
    const { response: requested, code } = await requestCode(email)
    const verified = await request(app()).post('/api/v1/auth/email/verify').send({
      challengeId: requested.body.challengeId,
      email,
      code,
    })
    const originalCookie = verified.headers['set-cookie']?.[0].split(';')[0]

    const refreshed = await request(app())
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200)
    expect(refreshed.body).toMatchObject({ accessToken: expect.any(String), expiresInSeconds: 900 })
    const rotatedCookie = refreshed.headers['set-cookie']?.[0].split(';')[0]

    await request(app()).post('/api/v1/auth/refresh').set('Cookie', originalCookie).expect(401)
    await request(app()).post('/api/v1/auth/refresh').set('Cookie', rotatedCookie).expect(401)

    const logoutEmail = 'logout@example.test'
    const secondLogin = await requestCode(logoutEmail)
    const secondVerified = await request(app()).post('/api/v1/auth/email/verify').send({
      challengeId: secondLogin.response.body.challengeId,
      email: logoutEmail,
      code: secondLogin.code,
    })
    const activeCookie = secondVerified.headers['set-cookie']?.[0].split(';')[0]
    const loggedOut = await request(app())
      .post('/api/v1/auth/logout')
      .set('Cookie', activeCookie)
      .expect(204)
    expect(loggedOut.headers['set-cookie']?.[0]).toContain('mwd_refresh=;')
    await request(app()).post('/api/v1/auth/refresh').set('Cookie', activeCookie).expect(401)
  })
})
