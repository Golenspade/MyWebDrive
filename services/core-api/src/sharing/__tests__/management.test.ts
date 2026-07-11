import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../../app.js'
import { issueAccessToken } from '../../auth/access-token.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const sessionSecret = 'task-six-management-session-secret-at-least-32-bytes'
const grantSecret = 'task-six-management-grant-secret-at-least-32-bytes'

integration('share and publication management', () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ??
          'postgresql://postgres:postgres@127.0.0.1:5432/mwd_task6?schema=public',
      },
    },
  })
  let now = new Date('2026-07-11T14:00:00.000Z')
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
        otpPepper: 'task-six-management-otp-pepper-at-least-32-bytes',
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

  async function createFile(ownerId: string, name = 'shared.bin', sizeBytes = 10n) {
    const file = await prisma.file.create({
      data: { ownerId, name, type: 'file' },
    })
    const intent = await prisma.uploadIntent.create({
      data: {
        userId: ownerId,
        idempotencyKey: `fixture-${randomUUID()}`,
        objectKey: randomUUID(),
        fileName: name,
        sizeBytes,
        mimeType: 'application/octet-stream',
        targetFileId: file.id,
        status: 'completed',
        expiresAt: new Date('2026-07-12T00:00:00.000Z'),
      },
    })
    await prisma.fileVersion.create({
      data: {
        fileId: file.id,
        uploadIntentId: intent.id,
        version: 1,
        objectKey: intent.objectKey,
        sizeBytes,
        mimeType: intent.mimeType,
        sha256: 'a'.repeat(64),
      },
    })
    return file
  }

  beforeAll(async () => prisma.$connect())
  beforeEach(async () => {
    now = new Date('2026-07-11T14:00:00.000Z')
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

  test('returns a real empty publication catalog', async () => {
    await request(app()).get('/api/v1/publications').expect(200, {
      items: [],
      nextCursor: null,
    })
  })

  test('creates a 256-bit share token once and stores only its SHA-256 digest', async () => {
    const owner = await createUser('share-owner@example.test')
    const file = await createFile(owner.id)
    const expiresAt = new Date(now.getTime() + 60_000).toISOString()
    const created = await request(app())
      .post(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({ password: 'correct horse battery staple', expiresAt, maxDownloads: 3 })

    expect(created.status).toBe(201)
    expect(created.body).toEqual({
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      expiresAt,
      maxDownloads: 3,
    })
    expect(Buffer.from(created.body.token, 'base64url')).toHaveLength(32)
    const stored = await prisma.share.findFirstOrThrow()
    expect(stored.token).toBe(
      createHash('sha256').update(created.body.token, 'utf8').digest('hex'),
    )
    expect(stored.token).not.toBe(created.body.token)
    expect(stored.passwordHash).toMatch(/^scrypt\$v=1\$/)
    expect(stored.passwordHash).not.toContain('correct horse battery staple')

    const listed = await request(app())
      .get(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(owner)}`)
    expect(listed.status).toBe(200)
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        id: stored.id,
        fileId: file.id,
        expiresAt,
        maxDownloads: 3,
        downloadCount: 0,
        isActive: true,
      }),
    ])
    expect(JSON.stringify(listed.body)).not.toContain(created.body.token)
    expect(JSON.stringify(listed.body)).not.toContain(stored.token)
    expect(JSON.stringify(listed.body)).not.toContain('passwordHash')
  })

  test('allows only an active owner to create, list and revoke shares', async () => {
    const owner = await createUser('manage-owner@example.test')
    const other = await createUser('manage-other@example.test')
    const disabled = await createUser('manage-disabled@example.test', 'disabled')
    const file = await createFile(owner.id)

    await request(app())
      .post(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(other)}`)
      .send({})
      .expect(404, { error: 'file not found' })
    await request(app())
      .get(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(404, { error: 'file not found' })
    await request(app())
      .post(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(disabled)}`)
      .send({})
      .expect(401, { error: 'invalid access token' })

    const created = await request(app())
      .post(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({})
    const stored = await prisma.share.findFirstOrThrow()
    expect(created.status).toBe(201)
    await request(app())
      .post(`/api/v1/shares/${stored.id}/revoke`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(404, { error: 'share not found' })
    await request(app())
      .post(`/api/v1/shares/${stored.id}/revoke`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(204)
    expect(await prisma.share.findUniqueOrThrow({ where: { id: stored.id } })).toMatchObject({
      isActive: false,
    })
  })

  test.each([
    { body: { expiresAt: 'not-a-date' }, label: 'malformed expiry' },
    { body: { expiresAt: '2026-07-11T13:59:59.999Z' }, label: 'past expiry' },
    { body: { maxDownloads: 0 }, label: 'zero downloads' },
    { body: { maxDownloads: 1.5 }, label: 'fractional downloads' },
    { body: { maxDownloads: 2_147_483_648 }, label: 'database-overflowing downloads' },
    { body: { password: '' }, label: 'empty password' },
    { body: { password: 'x'.repeat(1025) }, label: 'oversized password' },
  ])('rejects invalid share options: $label', async ({ body }) => {
    const owner = await createUser(`invalid-${randomUUID()}@example.test`)
    const file = await createFile(owner.id, `invalid-${randomUUID()}.bin`)
    await request(app())
      .post(`/api/v1/files/${file.id}/shares`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send(body)
      .expect(400, { error: 'invalid share options' })
    expect(await prisma.share.count()).toBe(0)
  })

  test('manages publications with owner authorization, slug validation and uniqueness', async () => {
    const owner = await createUser('publication-owner@example.test')
    const other = await createUser('publication-other@example.test')
    const first = await createFile(owner.id, 'first.bin')
    const second = await createFile(other.id, 'second.bin')

    await request(app())
      .put(`/api/v1/files/${first.id}/publication`)
      .set('Authorization', `Bearer ${token(other)}`)
      .send({ slug: 'private-file', status: 'published' })
      .expect(404, { error: 'file not found' })
    for (const body of [
      { slug: 'Uppercase', status: 'published' },
      { slug: '-leading', status: 'published' },
      { slug: 'trailing-', status: 'published' },
      { slug: 'a'.repeat(65), status: 'published' },
      { slug: 'valid', status: 'unknown' },
    ]) {
      await request(app())
        .put(`/api/v1/files/${first.id}/publication`)
        .set('Authorization', `Bearer ${token(owner)}`)
        .send(body)
        .expect(400, { error: 'invalid publication' })
    }

    await request(app())
      .put(`/api/v1/files/${first.id}/publication`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send({ slug: 'stable-release', status: 'published' })
      .expect(200)
    await request(app())
      .put(`/api/v1/files/${second.id}/publication`)
      .set('Authorization', `Bearer ${token(other)}`)
      .send({ slug: 'stable-release', status: 'published' })
      .expect(409, { error: 'publication slug unavailable' })
  })

  test('catalog exposes only published active-owner files with BigInt strings and a context-bound cursor', async () => {
    const owner = await createUser('catalog-owner@example.test')
    const disabledOwner = await createUser('catalog-disabled@example.test', 'disabled')
    const createdAt = new Date('2026-07-11T13:00:00.000Z')
    const publishedFiles = []
    for (let index = 0; index < 3; index += 1) {
      const file = await createFile(
        owner.id,
        `published-${index}.bin`,
        9_007_199_254_740_993n + BigInt(index),
      )
      publishedFiles.push(file)
      await prisma.publication.create({
        data: {
          fileId: file.id,
          slug: `published-${index}`,
          status: 'published',
          createdAt,
        },
      })
    }
    const draft = await createFile(owner.id, 'draft.bin')
    await prisma.publication.create({ data: { fileId: draft.id, slug: 'draft', status: 'draft' } })
    const disabledFile = await createFile(disabledOwner.id, 'disabled-owner.bin')
    await prisma.publication.create({
      data: { fileId: disabledFile.id, slug: 'disabled-owner', status: 'published' },
    })

    const first = await request(app()).get('/api/v1/publications?limit=2')
    expect(first.status).toBe(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toEqual(expect.any(String))
    expect(first.body.items.every((item: { status: string }) => item.status === 'published')).toBe(true)
    expect(first.body.items.every((item: { sizeBytes: string }) => /^900719925474099[3-5]$/.test(item.sizeBytes))).toBe(true)

    const second = await request(app()).get(
      `/api/v1/publications?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
    )
    expect(second.status).toBe(200)
    expect(second.body.items).toHaveLength(1)
    expect(second.body.nextCursor).toBeNull()
    expect(
      new Set([...first.body.items, ...second.body.items].map((item: { id: string }) => item.id)).size,
    ).toBe(3)

    const fileCursor = await request(app())
      .get('/api/v1/files?limit=1')
      .set('Authorization', `Bearer ${token(owner)}`)
    expect(fileCursor.status).toBe(200)
    await request(app())
      .get(`/api/v1/publications?cursor=${encodeURIComponent(fileCursor.body.nextCursor)}`)
      .expect(400, { error: 'invalid cursor' })

    await prisma.user.update({ where: { id: owner.id }, data: { status: 'disabled' } })
    await request(app()).get('/api/v1/publications').expect(200, {
      items: [],
      nextCursor: null,
    })
    expect(publishedFiles).toHaveLength(3)
  })
})
