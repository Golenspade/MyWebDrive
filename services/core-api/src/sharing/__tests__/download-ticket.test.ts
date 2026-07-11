import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../../app.js'
import { issueAccessToken } from '../../auth/access-token.js'
import { verifyStorageGrant } from '../../grants/storage-grant.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const sessionSecret = 'task-six-ticket-session-secret-at-least-32-bytes'
const grantSecret = 'task-six-ticket-grant-secret-at-least-32-bytes'

integration('private, share and publication download tickets', () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ??
          'postgresql://postgres:postgres@127.0.0.1:5432/mwd_task6?schema=public',
      },
    },
  })
  let now = new Date('2026-07-11T15:00:00.000Z')
  const redis = { ping: vi.fn(async () => 'PONG') } as unknown as CoreDependencies['redis']

  function app() {
    return createCoreApp({
      prisma,
      redis,
      emailSender: { sendOtp: vi.fn(async () => undefined) },
      now: () => now,
      randomBytes,
      identity: {
        sessionSecret,
        otpPepper: 'task-six-ticket-otp-pepper-at-least-32-bytes',
        adminEmails: '',
        production: false,
        defaultUserQuotaBytes: 1000n,
      },
      storage: { grantSecret },
    })
  }

  function token(user: { id: string; role: string }) {
    return issueAccessToken(user, sessionSecret)
  }

  async function createUser(email: string, status = 'active') {
    return prisma.user.create({ data: { email, status } })
  }

  async function createVersionedFile(ownerId: string, name = 'download.bin') {
    const file = await prisma.file.create({ data: { ownerId, name, type: 'file' } })
    const versions = []
    for (let version = 1; version <= 2; version += 1) {
      const intent = await prisma.uploadIntent.create({
        data: {
          userId: ownerId,
          idempotencyKey: `ticket-${randomUUID()}`,
          objectKey: randomUUID(),
          fileName: name,
          sizeBytes: BigInt(version * 10),
          mimeType: version === 1 ? 'text/plain' : 'application/octet-stream',
          targetFileId: file.id,
          status: 'completed',
          expiresAt: new Date('2026-07-12T00:00:00.000Z'),
        },
      })
      versions.push(
        await prisma.fileVersion.create({
          data: {
            fileId: file.id,
            uploadIntentId: intent.id,
            version,
            objectKey: intent.objectKey,
            sizeBytes: intent.sizeBytes,
            mimeType: intent.mimeType,
            sha256: String(version).repeat(64),
          },
        }),
      )
    }
    return { file, versions }
  }

  async function createShare(
    owner: { id: string; role: string },
    fileId: string,
    body: Record<string, unknown> = {},
  ) {
    return request(app())
      .post(`/api/v1/files/${fileId}/shares`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send(body)
  }

  function expectTicket(
    body: Record<string, unknown>,
    expected: { objectKey: string; fileName: string; mimeType: string; purpose: string },
  ) {
    expect(body).toEqual({
      objectKey: expected.objectKey,
      downloadGrant: expect.any(String),
      expiresInSeconds: 60,
      fileName: expected.fileName,
      mimeType: expected.mimeType,
    })
    const grant = verifyStorageGrant(String(body.downloadGrant), grantSecret, now)
    expect(grant).toEqual({
      aud: 'storage-api',
      purpose: expected.purpose,
      objectKey: expected.objectKey,
      jti: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(now.getTime() / 1000) + 60,
    })
    expect(JSON.stringify(body)).not.toMatch(/https?:\/\//)
  }

  beforeAll(async () => prisma.$connect())
  beforeEach(async () => {
    now = new Date('2026-07-11T15:00:00.000Z')
    await prisma.outboxEvent.deleteMany()
    await prisma.share.deleteMany()
    await prisma.publication.deleteMany()
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
  afterAll(async () => prisma.$disconnect())

  test('issues an exact 60-second private grant for the owner and highest file version', async () => {
    const owner = await createUser('private-owner@example.test')
    const other = await createUser('private-other@example.test')
    const { file, versions } = await createVersionedFile(owner.id)
    const latest = versions[1]!

    const response = await request(app())
      .post(`/api/v1/files/${file.id}/download-ticket`)
      .set('Authorization', `Bearer ${token(owner)}`)
    expect(response.status).toBe(200)
    expectTicket(response.body, {
      objectKey: latest.objectKey,
      fileName: file.name,
      mimeType: latest.mimeType,
      purpose: 'download-private',
    })
    expect(() => verifyStorageGrant(response.body.downloadGrant, sessionSecret, now)).toThrow(
      'invalid storage grant',
    )

    await request(app())
      .post(`/api/v1/files/${file.id}/download-ticket`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(404, { error: 'file not found' })
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'disabled' } })
    await request(app())
      .post(`/api/v1/files/${file.id}/download-ticket`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(401, { error: 'invalid access token' })
  })

  test('verifies an optional share password and never accepts the wrong one', async () => {
    const owner = await createUser('password-owner@example.test')
    const { file, versions } = await createVersionedFile(owner.id, 'password.bin')
    const created = await createShare(owner, file.id, { password: 'share-secret' })
    expect(created.status).toBe(201)

    await request(app())
      .post(`/api/v1/shares/${created.body.token}/download-ticket`)
      .send({ password: 'wrong-secret' })
      .expect(404, { error: 'share unavailable' })
    expect((await prisma.share.findFirstOrThrow()).downloadCount).toBe(0)

    const response = await request(app())
      .post(`/api/v1/shares/${created.body.token}/download-ticket`)
      .send({ password: 'share-secret' })
    expect(response.status).toBe(200)
    expectTicket(response.body, {
      objectKey: versions[1]!.objectKey,
      fileName: file.name,
      mimeType: versions[1]!.mimeType,
      purpose: 'download-share',
    })
    const stored = await prisma.share.findFirstOrThrow()
    expect(stored.token).toBe(createHash('sha256').update(created.body.token).digest('hex'))
    expect(stored.downloadCount).toBe(1)
  })

  test('rejects expired, revoked, exhausted, malformed-hash and disabled-owner shares without details', async () => {
    const owner = await createUser('unavailable-owner@example.test')
    const { file } = await createVersionedFile(owner.id, 'unavailable.bin')

    const expired = await createShare(owner, file.id, {
      expiresAt: new Date(now.getTime() + 1000).toISOString(),
    })
    now = new Date(now.getTime() + 1001)
    await request(app())
      .post(`/api/v1/shares/${expired.body.token}/download-ticket`)
      .send({})
      .expect(404, { error: 'share unavailable' })

    now = new Date('2026-07-11T15:00:00.000Z')
    const revoked = await createShare(owner, file.id)
    const revokedRow = await prisma.share.findFirstOrThrow({
      where: { token: createHash('sha256').update(revoked.body.token).digest('hex') },
    })
    await prisma.share.update({ where: { id: revokedRow.id }, data: { isActive: false } })
    await request(app())
      .post(`/api/v1/shares/${revoked.body.token}/download-ticket`)
      .send({})
      .expect(404, { error: 'share unavailable' })

    const exhausted = await createShare(owner, file.id, { maxDownloads: 1 })
    const exhaustedDigest = createHash('sha256').update(exhausted.body.token).digest('hex')
    await prisma.share.update({
      where: { token: exhaustedDigest },
      data: { downloadCount: 1 },
    })
    await request(app())
      .post(`/api/v1/shares/${exhausted.body.token}/download-ticket`)
      .send({})
      .expect(404, { error: 'share unavailable' })

    const malformed = await createShare(owner, file.id, { password: 'secret' })
    await prisma.share.update({
      where: { token: createHash('sha256').update(malformed.body.token).digest('hex') },
      data: { passwordHash: 'scrypt$v=1$n=999999999,r=999,p=999$bad$bad' },
    })
    await request(app())
      .post(`/api/v1/shares/${malformed.body.token}/download-ticket`)
      .send({ password: 'secret' })
      .expect(404, { error: 'share unavailable' })

    const disabledOwnerShare = await createShare(owner, file.id)
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'disabled' } })
    await request(app())
      .post(`/api/v1/shares/${disabledOwnerShare.body.token}/download-ticket`)
      .send({})
      .expect(404, { error: 'share unavailable' })
  })

  test('atomically admits exactly one of two requests for the final share download', async () => {
    const owner = await createUser('race-owner@example.test')
    const { file } = await createVersionedFile(owner.id, 'race.bin')
    const created = await createShare(owner, file.id, { maxDownloads: 1 })
    expect(created.status).toBe(201)

    const responses = await Promise.all([
      request(app()).post(`/api/v1/shares/${created.body.token}/download-ticket`).send({}),
      request(app()).post(`/api/v1/shares/${created.body.token}/download-ticket`).send({}),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 404])
    expect((await prisma.share.findFirstOrThrow()).downloadCount).toBe(1)
    expect(responses.filter((response) => response.body.downloadGrant)).toHaveLength(1)
  })

  test('issues publication grants only for published active-owner files', async () => {
    const owner = await createUser('public-owner@example.test')
    const { file, versions } = await createVersionedFile(owner.id, 'public.bin')
    await prisma.publication.create({ data: { fileId: file.id, slug: 'public-release', status: 'draft' } })

    await request(app())
      .post('/api/v1/publications/public-release/download-ticket')
      .send({})
      .expect(404, { error: 'publication unavailable' })
    await prisma.publication.update({
      where: { fileId: file.id },
      data: { status: 'published' },
    })
    const response = await request(app())
      .post('/api/v1/publications/public-release/download-ticket')
      .send({})
    expect(response.status).toBe(200)
    expectTicket(response.body, {
      objectKey: versions[1]!.objectKey,
      fileName: file.name,
      mimeType: versions[1]!.mimeType,
      purpose: 'download-publication',
    })

    await prisma.publication.update({
      where: { fileId: file.id },
      data: { status: 'disabled' },
    })
    await request(app())
      .post('/api/v1/publications/public-release/download-ticket')
      .send({})
      .expect(404, { error: 'publication unavailable' })
    await prisma.publication.update({
      where: { fileId: file.id },
      data: { status: 'published' },
    })
    await prisma.user.update({ where: { id: owner.id }, data: { status: 'disabled' } })
    await request(app())
      .post('/api/v1/publications/public-release/download-ticket')
      .send({})
      .expect(404, { error: 'publication unavailable' })
  })
})
