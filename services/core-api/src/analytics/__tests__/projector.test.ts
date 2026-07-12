import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { projectOutboxEvent } from '../projector.js'
import { createOtpDigest, verifyEmailOtp } from '../../identity/otp.js'
import { rotateRefreshSession } from '../../identity/session.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))

integration('analytics projector', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } })
    await prisma.$connect()
  })

  beforeEach(async () => {
    await prisma.analyticsEventReceipt.deleteMany()
    await prisma.analyticsDailyActiveUser.deleteMany()
    await prisma.analyticsDaily.deleteMany()
    await prisma.outboxEvent.deleteMany()
    await prisma.share.deleteMany()
    await prisma.publication.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.quotaLedgerEntry.deleteMany()
    await prisma.quotaReservation.deleteMany()
    await prisma.uploadIntent.deleteMany()
    await prisma.file.deleteMany()
    await prisma.refreshSession.deleteMany()
    await prisma.emailOtpChallenge.deleteMany()
    await prisma.quotaAccount.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.analyticsEventReceipt.deleteMany()
    await prisma.analyticsDailyActiveUser.deleteMany()
    await prisma.analyticsDaily.deleteMany()
    await prisma.outboxEvent.deleteMany()
    await prisma.share.deleteMany()
    await prisma.publication.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.quotaLedgerEntry.deleteMany()
    await prisma.quotaReservation.deleteMany()
    await prisma.uploadIntent.deleteMany()
    await prisma.file.deleteMany()
    await prisma.refreshSession.deleteMany()
    await prisma.emailOtpChallenge.deleteMany()
    await prisma.quotaAccount.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('projects each source key once into daily counters and active users', async () => {
    const occurredAt = new Date('2026-07-12T12:00:00.000Z')
    const events = await Promise.all([
      prisma.outboxEvent.create({
        data: {
          dedupeKey: 'file.version.created:version-1',
          topic: 'file.version.created',
          aggregateId: 'file-1',
          occurredAt,
          payload: { versionId: 'version-1', sizeBytes: '17' },
        },
      }),
      prisma.outboxEvent.create({
        data: {
          dedupeKey: 'user.created:user-1',
          topic: 'user.created',
          aggregateId: 'user-1',
          occurredAt,
          payload: { userId: 'user-1' },
        },
      }),
      prisma.outboxEvent.create({
        data: {
          dedupeKey: 'user.activity:user-1:2026-07-12',
          topic: 'user.activity.recorded',
          aggregateId: 'user-1',
          occurredAt,
          payload: { userId: 'user-1' },
        },
      }),
    ])

    await prisma.$transaction(async (tx) => {
      for (const event of events) await projectOutboxEvent(tx, event)
      await projectOutboxEvent(tx, events[0]!)
    })

    expect(await prisma.analyticsEventReceipt.count()).toBe(3)
    expect(await prisma.analyticsDaily.findUniqueOrThrow({
      where: { date: new Date('2026-07-12T00:00:00.000Z') },
    })).toMatchObject({ uploadsCount: 1n, uploadsBytes: 17n, createdUsers: 1n })
    expect(await prisma.analyticsDailyActiveUser.findMany()).toEqual([
      {
        date: new Date('2026-07-12T00:00:00.000Z'),
        userId: 'user-1',
        firstSeenAt: occurredAt,
      },
    ])
  })

  test('enqueues new-user and one-per-Shanghai-day session activity events transactionally', async () => {
    const firstNow = new Date('2026-07-12T12:00:00.000Z')
    const email = 'analytics-identity@example.test'
    const code = '123456'
    const pepper = 'analytics-identity-test-pepper'
    const challenge = await prisma.emailOtpChallenge.create({
      data: {
        email,
        codeDigest: '',
        expiresAt: new Date(firstNow.getTime() + 60_000),
        requestedIpHash: 'opaque-ip-hash',
        deliveryStatus: 'sent',
      },
    })
    await prisma.emailOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        codeDigest: createOtpDigest(pepper, challenge.id, email, code).toString('hex'),
      },
    })

    const verified = await verifyEmailOtp({
      prisma,
      challengeId: challenge.id,
      email,
      code,
      now: firstNow,
      pepper,
      adminEmails: new Set(),
      randomBytes: (size) => Buffer.alloc(size, 3),
      defaultUserQuotaBytes: 100n,
    })
    await rotateRefreshSession(
      prisma,
      verified.refreshToken,
      new Date('2026-07-12T15:59:59.000Z'),
      (size) => Buffer.alloc(size, 4),
    ).then((sameDay) =>
      rotateRefreshSession(
        prisma,
        sameDay.token,
        new Date('2026-07-12T16:00:00.000Z'),
        (size) => Buffer.alloc(size, 5),
      ),
    )

    const events = await prisma.outboxEvent.findMany({ orderBy: { dedupeKey: 'asc' } })
    expect(events.map(({ dedupeKey, topic, aggregateId, occurredAt, payload }) => ({
      dedupeKey,
      topic,
      aggregateId,
      occurredAt,
      payload,
    }))).toEqual([
      {
        dedupeKey: `user.activity:${verified.user.id}:2026-07-12`,
        topic: 'user.activity.recorded',
        aggregateId: verified.user.id,
        occurredAt: firstNow,
        payload: { userId: verified.user.id },
      },
      {
        dedupeKey: `user.activity:${verified.user.id}:2026-07-13`,
        topic: 'user.activity.recorded',
        aggregateId: verified.user.id,
        occurredAt: new Date('2026-07-12T16:00:00.000Z'),
        payload: { userId: verified.user.id },
      },
      {
        dedupeKey: `user.created:${verified.user.id}`,
        topic: 'user.created',
        aggregateId: verified.user.id,
        occurredAt: firstNow,
        payload: { userId: verified.user.id },
      },
    ])
  })
})
