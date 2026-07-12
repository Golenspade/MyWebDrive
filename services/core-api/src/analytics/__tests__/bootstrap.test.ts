import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { bootstrapAnalyticsReadModel } from '../bootstrap.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const now = new Date('2026-07-12T12:00:00.000Z')

integration('analytics read-model bootstrap', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } })
    await prisma.$connect()
  })

  beforeEach(async () => {
    await prisma.analyticsEventReceipt.deleteMany()
    await prisma.analyticsDailyActiveUser.deleteMany()
    await prisma.analyticsDaily.deleteMany()
    await prisma.analyticsCoverage.deleteMany()
    await prisma.outboxEvent.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.quotaReservation.deleteMany()
    await prisma.uploadIntent.deleteMany()
    await prisma.file.deleteMany()
    await prisma.quotaAccount.deleteMany()
    await prisma.refreshSession.deleteMany()
    await prisma.emailOtpChallenge.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.fileVersion.deleteMany()
    await prisma.uploadIntent.deleteMany()
    await prisma.file.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('backfills historical file versions once and establishes metric cutovers', async () => {
    const user = await prisma.user.create({ data: { email: 'bootstrap@example.test' } })
    const file = await prisma.file.create({
      data: { ownerId: user.id, name: 'history.txt', type: 'file' },
    })
    const versions = [
      { id: 'bootstrap-version-1', at: new Date('2026-07-10T15:59:00.000Z'), bytes: 10n },
      { id: 'bootstrap-version-2', at: new Date('2026-07-10T16:00:00.000Z'), bytes: 20n },
    ]
    for (const [index, version] of versions.entries()) {
      const intent = await prisma.uploadIntent.create({
        data: {
          userId: user.id,
          idempotencyKey: `bootstrap-${index}`,
          objectKey: `bootstrap-object-${index}`,
          fileName: 'history.txt',
          sizeBytes: version.bytes,
          mimeType: 'text/plain',
          status: 'completed',
          expiresAt: now,
          completedAt: version.at,
        },
      })
      await prisma.fileVersion.create({
        data: {
          id: version.id,
          fileId: file.id,
          uploadIntentId: intent.id,
          version: index + 1,
          objectKey: intent.objectKey,
          sizeBytes: version.bytes,
          mimeType: 'text/plain',
          sha256: String(index + 1).repeat(64),
          createdAt: version.at,
        },
      })
    }

    await bootstrapAnalyticsReadModel({ prisma, now: () => now })
    const gapStartedAt = new Date('2026-07-12T11:00:00.000Z')
    await prisma.analyticsCoverage.update({
      where: { metric: 'uploads' },
      data: { complete: false, gapStartedAt },
    })
    await bootstrapAnalyticsReadModel({ prisma, now: () => now })

    expect(await prisma.analyticsDaily.findMany({ orderBy: { date: 'asc' } })).toEqual([
      expect.objectContaining({
        date: new Date('2026-07-10T00:00:00.000Z'),
        uploadsCount: 1n,
        uploadsBytes: 10n,
      }),
      expect.objectContaining({
        date: new Date('2026-07-11T00:00:00.000Z'),
        uploadsCount: 1n,
        uploadsBytes: 20n,
      }),
    ])
    expect(
      await prisma.analyticsEventReceipt.findMany({ orderBy: { sourceKey: 'asc' } }),
    ).toEqual([
      expect.objectContaining({
        sourceKey: 'file.version.created:bootstrap-version-1',
        outboxEventId: null,
        topic: 'file.version.created',
        occurredAt: versions[0]!.at,
      }),
      expect.objectContaining({
        sourceKey: 'file.version.created:bootstrap-version-2',
        outboxEventId: null,
        topic: 'file.version.created',
        occurredAt: versions[1]!.at,
      }),
    ])
    expect(await prisma.analyticsCoverage.findMany({ orderBy: { metric: 'asc' } })).toEqual([
      expect.objectContaining({ metric: 'activeUsers', startedAt: now, complete: true }),
      expect.objectContaining({ metric: 'downloads', startedAt: now, complete: true }),
      expect.objectContaining({
        metric: 'uploads',
        startedAt: versions[0]!.at,
        complete: false,
        gapStartedAt,
      }),
    ])
  })

  test('uses cutover time for uploads when authoritative history is empty', async () => {
    await bootstrapAnalyticsReadModel({ prisma, now: () => now })

    expect(await prisma.analyticsCoverage.findUniqueOrThrow({ where: { metric: 'uploads' } }))
      .toMatchObject({ startedAt: now, complete: true, gapStartedAt: null })
    expect(await prisma.analyticsDaily.count()).toBe(0)
    expect(await prisma.analyticsEventReceipt.count()).toBe(0)
  })
})
