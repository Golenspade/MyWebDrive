import { PrismaClient } from '@prisma/client'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { issueAccessToken } from '../../auth/access-token.js'
import { createAnalyticsRouter } from '../router.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const now = new Date('2026-07-12T12:00:00.000Z')
const sessionSecret = 'analytics-router-session-secret-at-least-32-bytes'

integration('business analytics router', () => {
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
    await prisma.analyticsDailyActiveUser.deleteMany()
    await prisma.analyticsDaily.deleteMany()
    await prisma.analyticsCoverage.deleteMany()
    await prisma.file.deleteMany()
    await prisma.quotaAccount.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  function app() {
    const application = express()
    application.use(
      '/api/v1',
      createAnalyticsRouter({ prisma, sessionSecret, now: () => now }),
    )
    return application
  }

  async function createUser(role: string, email: string) {
    return prisma.user.create({ data: { role, email } })
  }

  test('requires a live administrator identity', async () => {
    await request(app()).get('/api/v1/admin/dashboard/business?range=7d').expect(401)

    const user = await createUser('user', 'dashboard-user@example.test')
    await request(app())
      .get('/api/v1/admin/dashboard/business?range=7d')
      .set('Authorization', `Bearer ${issueAccessToken(user, sessionSecret)}`)
      .expect(403)
  })

  test('rejects unsupported ranges', async () => {
    const admin = await createUser('admin', 'dashboard-range-admin@example.test')

    await request(app())
      .get('/api/v1/admin/dashboard/business?range=last7d')
      .set('Authorization', `Bearer ${issueAccessToken(admin, sessionSecret)}`)
      .expect(400, { error: 'invalid dashboard range' })
  })

  test('returns authoritative totals, fully bucketed projections, coverage and freshness', async () => {
    const admin = await createUser('admin', 'dashboard-admin@example.test')
    const disabled = await prisma.user.create({
      data: { email: 'dashboard-disabled@example.test', status: 'disabled' },
    })
    await prisma.quotaAccount.createMany({
      data: [
        { userId: admin.id, limitBytes: 100n, committedBytes: 41n },
        { userId: disabled.id, limitBytes: 100n, committedBytes: 42n },
      ],
    })
    await prisma.file.createMany({
      data: [
        { ownerId: admin.id, name: 'live', type: 'file' },
        { ownerId: admin.id, name: 'folder', type: 'folder' },
        { ownerId: admin.id, name: 'deleted', type: 'file', deletedAt: now },
      ],
    })
    await prisma.analyticsDaily.create({
      data: {
        date: new Date('2026-07-12T00:00:00.000Z'),
        uploadsCount: 2n,
        uploadsBytes: 17n,
        downloadsCount: 3n,
        downloadsBytes: 29n,
        updatedAt: new Date('2026-07-12T11:59:58.000Z'),
      },
    })
    await prisma.analyticsDailyActiveUser.createMany({
      data: [
        { date: new Date('2026-07-11T00:00:00.000Z'), userId: admin.id, firstSeenAt: now },
        { date: new Date('2026-07-12T00:00:00.000Z'), userId: admin.id, firstSeenAt: now },
        { date: new Date('2026-07-12T00:00:00.000Z'), userId: disabled.id, firstSeenAt: now },
      ],
    })
    await prisma.analyticsCoverage.createMany({
      data: [
        { metric: 'uploads', startedAt: new Date('2026-07-05T16:00:00.000Z') },
        { metric: 'downloads', startedAt: new Date('2026-07-09T16:00:00.000Z') },
        { metric: 'activeUsers', startedAt: new Date('2026-07-05T16:00:00.000Z') },
      ],
    })

    const response = await request(app())
      .get('/api/v1/admin/dashboard/business?range=7d')
      .set('Authorization', `Bearer ${issueAccessToken(admin, sessionSecret)}`)
      .expect(200)

    expect(response.body.range).toEqual({
      kind: '7d',
      timezone: 'Asia/Shanghai',
      start: '2026-07-05T16:00:00.000Z',
      end: now.toISOString(),
    })
    expect(response.body.generatedAt).toBe(now.toISOString())
    expect(response.body.coverage).toEqual({
      uploadsFrom: '2026-07-05T16:00:00.000Z',
      downloadsFrom: '2026-07-09T16:00:00.000Z',
      complete: false,
    })
    expect(response.body.totals).toEqual({
      totalUsers: '2',
      liveFiles: '1',
      committedStorageBytes: '83',
    })
    expect(response.body.activity.uploads).toEqual({
      count: '2',
      bytes: '17',
      series: [
        ...['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11'].map((date) => ({ date, count: '0', bytes: '0' })),
        { date: '2026-07-12', count: '2', bytes: '17' },
      ],
    })
    expect(response.body.activity.downloads).toEqual({
      count: '3',
      bytes: '29',
      series: [
        ...['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09'].map((date) => ({ date, count: null, bytes: null })),
        { date: '2026-07-10', count: '0', bytes: '0' },
        { date: '2026-07-11', count: '0', bytes: '0' },
        { date: '2026-07-12', count: '3', bytes: '29' },
      ],
    })
    expect(response.body.activity.activeUsers).toEqual({
      count: '2',
      series: [
        ...['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'].map((date) => ({ date, count: '0' })),
        { date: '2026-07-11', count: '1' },
        { date: '2026-07-12', count: '2' },
      ],
    })
    expect(response.body.freshness).toEqual({
      readModelUpdatedAt: '2026-07-12T11:59:58.000Z',
      lagSeconds: 2,
    })
  })

  test('returns observed values for a partially covered current bucket', async () => {
    const admin = await createUser('admin', 'dashboard-partial-admin@example.test')
    await prisma.analyticsDaily.create({
      data: {
        date: new Date('2026-07-12T00:00:00.000Z'),
        uploadsCount: 1n,
        uploadsBytes: 45n,
        downloadsCount: 3n,
        downloadsBytes: 135n,
      },
    })
    await prisma.analyticsDailyActiveUser.create({
      data: {
        date: new Date('2026-07-12T00:00:00.000Z'),
        userId: admin.id,
        firstSeenAt: new Date('2026-07-12T10:00:00.000Z'),
      },
    })
    await prisma.analyticsCoverage.createMany({
      data: ['uploads', 'downloads', 'activeUsers'].map((metric) => ({
        metric,
        startedAt: new Date('2026-07-12T10:00:00.000Z'),
      })),
    })

    const response = await request(app())
      .get('/api/v1/admin/dashboard/business?range=today')
      .set('Authorization', `Bearer ${issueAccessToken(admin, sessionSecret)}`)
      .expect(200)

    expect(response.body.coverage.complete).toBe(false)
    expect(response.body.activity).toEqual({
      uploads: {
        count: '1',
        bytes: '45',
        series: [{ date: '2026-07-12', count: '1', bytes: '45' }],
      },
      downloads: {
        count: '3',
        bytes: '135',
        series: [{ date: '2026-07-12', count: '3', bytes: '135' }],
      },
      activeUsers: {
        count: '1',
        series: [{ date: '2026-07-12', count: '1' }],
      },
    })
  })

  test('keeps a completed historical range covered when its gap starts later', async () => {
    const admin = await createUser('admin', 'dashboard-gap-admin@example.test')
    const gapStartedAt = new Date('2026-07-13T00:00:00.000Z')
    await prisma.analyticsDaily.create({
      data: {
        date: new Date('2026-07-12T00:00:00.000Z'),
        uploadsCount: 3n,
        uploadsBytes: 30n,
        downloadsCount: 4n,
        downloadsBytes: 40n,
      },
    })
    await prisma.analyticsCoverage.createMany({
      data: ['uploads', 'downloads', 'activeUsers'].map((metric) => ({
        metric,
        startedAt: new Date('2026-07-11T16:00:00.000Z'),
        complete: false,
        gapStartedAt,
      })),
    })

    const response = await request(app())
      .get('/api/v1/admin/dashboard/business?range=today')
      .set('Authorization', `Bearer ${issueAccessToken(admin, sessionSecret)}`)
      .expect(200)

    expect(response.body.coverage.complete).toBe(true)
    expect(response.body.activity).toMatchObject({
      uploads: { count: '3', bytes: '30' },
      downloads: { count: '4', bytes: '40' },
      activeUsers: { count: '0' },
    })
  })
})
