import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../../app.js'
import { issueAccessToken } from '../../auth/access-token.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const sessionSecret = 'task-five-metadata-session-at-least-32-bytes'

integration('file metadata authorization and cursors', () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ??
          'postgresql://postgres:postgres@127.0.0.1:5432/mwd_task5?schema=public',
      },
    },
  })
  const now = new Date('2026-07-11T12:00:00.000Z')
  const redis = { ping: vi.fn(async () => 'PONG') } as unknown as CoreDependencies['redis']

  function app() {
    return createCoreApp({
      prisma,
      redis,
      emailSender: { sendOtp: vi.fn(async () => undefined) },
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 6),
      identity: {
        sessionSecret,
        otpPepper: 'task-five-metadata-otp-at-least-32-bytes',
        adminEmails: '',
        production: false,
        defaultUserQuotaBytes: 1000n,
      },
      storage: {
        grantSecret: 'task-five-metadata-grant-at-least-32-bytes',
        callbackSecret: 'task-five-metadata-callback-at-least-32-bytes',
      },
    })
  }

  function token(user: { id: string; role: string }) {
    return issueAccessToken(user, sessionSecret)
  }

  async function user(email: string, role = 'user') {
    return prisma.user.create({ data: { email, role } })
  }

  beforeAll(async () => prisma.$connect())
  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.quotaLedgerEntry.deleteMany()
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

  test('current user and admin list only authorized files with stable signed cursor pagination', async () => {
    const owner = await user('list-owner@example.test')
    const other = await user('list-other@example.test')
    const admin = await user('list-admin@example.test', 'admin')
    const createdAt = new Date('2026-07-11T11:00:00.000Z')
    for (let index = 0; index < 3; index += 1) {
      await prisma.file.create({
        data: { ownerId: owner.id, name: `file-${index}`, type: 'file', createdAt },
      })
    }
    await prisma.file.create({ data: { ownerId: other.id, name: 'other', type: 'file' } })

    const first = await request(app())
      .get('/api/v1/files?parentId=null&limit=2')
      .set('Authorization', `Bearer ${token(owner)}`)
    expect(first.status).toBe(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.items.every((item: { ownerId: string }) => item.ownerId === owner.id)).toBe(true)
    expect(first.body.nextCursor).toEqual(expect.any(String))
    await request(app())
      .get(`/api/v1/files?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(400, { error: 'invalid cursor' })
    await request(app())
      .get(`/api/v1/files?parentId=null&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(400, { error: 'invalid cursor' })
    const second = await request(app())
      .get(`/api/v1/files?parentId=null&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${token(owner)}`)
    expect(second.status).toBe(200)
    expect(second.body.items).toHaveLength(1)
    expect(new Set([...first.body.items, ...second.body.items].map((item) => item.id)).size).toBe(3)
    const tampered = `${first.body.nextCursor.slice(0, -1)}x`
    await request(app())
      .get(`/api/v1/files?parentId=null&limit=2&cursor=${encodeURIComponent(tampered)}`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(400, { error: 'invalid cursor' })

    await request(app())
      .get(`/api/v1/admin/users/${owner.id}/files?limit=50`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(403)
    const adminList = await request(app())
      .get(`/api/v1/admin/users/${owner.id}/files?limit=50`)
      .set('Authorization', `Bearer ${token(admin)}`)
    expect(adminList.status).toBe(200)
    expect(adminList.body.items).toHaveLength(3)
    await request(app())
      .get(`/api/v1/admin/users/${owner.id}/files?cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .expect(400, { error: 'invalid cursor' })
    await request(app())
      .get(`/api/v1/admin/users/11111111-1111-4111-8111-111111111111/files`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .expect(404, { error: 'user not found' })
  })

  test('version listing requires owner or current database admin and serializes bigint as decimal', async () => {
    const owner = await user('versions-owner@example.test')
    const other = await user('versions-other@example.test')
    const admin = await user('versions-admin@example.test', 'admin')
    const file = await prisma.file.create({
      data: { ownerId: owner.id, name: 'versions.bin', type: 'file' },
    })
    for (let index = 1; index <= 2; index += 1) {
      const intent = await prisma.uploadIntent.create({
        data: {
          userId: owner.id,
          idempotencyKey: `version-${index}`,
          objectKey: `opaque-object-${index}`,
          fileName: file.name,
          sizeBytes: 9_007_199_254_740_993n + BigInt(index),
          mimeType: 'application/octet-stream',
          targetFileId: file.id,
          expiresAt: new Date('2026-07-12T00:00:00.000Z'),
          status: 'completed',
        },
      })
      await prisma.fileVersion.create({
        data: {
          fileId: file.id,
          uploadIntentId: intent.id,
          version: index,
          objectKey: intent.objectKey,
          sizeBytes: intent.sizeBytes,
          mimeType: intent.mimeType,
          sha256: String(index).repeat(64),
        },
      })
    }

    await request(app())
      .get(`/api/v1/files/${file.id}/versions`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(404)
    for (const viewer of [owner, admin]) {
      const response = await request(app())
        .get(`/api/v1/files/${file.id}/versions?limit=1`)
        .set('Authorization', `Bearer ${token(viewer)}`)
      expect(response.status).toBe(200)
      expect(response.body.items).toHaveLength(1)
      expect(response.body.items[0].sizeBytes).toMatch(/^900719925474099[45]$/)
      expect(response.body.nextCursor).toEqual(expect.any(String))
      const otherFile = await prisma.file.create({
        data: { ownerId: owner.id, name: `other-${viewer.id}.bin`, type: 'file' },
      })
      await request(app())
        .get(
          `/api/v1/files/${otherFile.id}/versions?cursor=${encodeURIComponent(response.body.nextCursor)}`,
        )
        .set('Authorization', `Bearer ${token(viewer)}`)
        .expect(400, { error: 'invalid cursor' })
    }
  })
})
