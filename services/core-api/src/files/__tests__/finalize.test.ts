import { createHmac, randomUUID } from 'node:crypto'

import { Prisma, PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../../app.js'
import { issueAccessToken } from '../../auth/access-token.js'
import { completeUploadIntent } from '../../uploads/service.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const sessionSecret = 'task-five-session-secret-at-least-32-bytes'
const grantSecret = 'task-five-storage-grant-at-least-32-bytes'
const callbackSecret = 'task-five-callback-secret-at-least-32-bytes'

integration('transactional upload finalization', () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ??
          'postgresql://postgres:postgres@127.0.0.1:5432/mwd_task5?schema=public',
      },
    },
  })
  let now = new Date('2026-07-11T10:00:00.000Z')
  const redis = { ping: vi.fn(async () => 'PONG') } as unknown as CoreDependencies['redis']

  function app() {
    return createCoreApp({
      prisma,
      redis,
      emailSender: { sendOtp: vi.fn(async () => undefined) },
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 5),
      identity: {
        sessionSecret,
        otpPepper: 'task-five-otp-pepper-at-least-32-bytes',
        adminEmails: '',
        production: false,
        defaultUserQuotaBytes: 1000n,
      },
      storage: { grantSecret, callbackSecret },
    })
  }

  function token(user: { id: string; role: string }) {
    return issueAccessToken(user, sessionSecret)
  }

  async function createUser(email: string, role = 'user') {
    const user = await prisma.user.create({ data: { email, role } })
    await prisma.quotaAccount.create({
      data: { userId: user.id, limitBytes: 1000n },
    })
    return user
  }

  async function createIntent(
    user: { id: string; role: string },
    key: string,
    name: string,
    size = '10',
  ) {
    return request(app())
      .post('/api/v1/upload-intents')
      .set('Authorization', `Bearer ${token(user)}`)
      .set('Idempotency-Key', key)
      .send({ fileName: name, sizeBytes: size, mimeType: 'text/plain' })
  }

  async function createReplacementIntent(
    user: { id: string; role: string },
    fileId: string,
    key: string,
    size = '10',
  ) {
    return request(app())
      .post(`/api/v1/files/${fileId}/upload-intents`)
      .set('Authorization', `Bearer ${token(user)}`)
      .set('Idempotency-Key', key)
      .send({ sizeBytes: size, mimeType: 'text/plain' })
  }

  function signedCompletion(
    intentId: string,
    body: Record<string, unknown>,
    timestamp = Math.floor(now.getTime() / 1000).toString(),
    secret = callbackSecret,
  ) {
    const raw = JSON.stringify(body)
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest('hex')
    return request(app())
      .post(`/api/v1/internal/upload-intents/${intentId}/complete`)
      .set('Content-Type', 'application/json')
      .set('X-Core-Timestamp', timestamp)
      .set('X-Core-Signature', signature)
      .send(raw)
  }

  function signedRawCompletion(
    intentId: string,
    raw: string,
    timestamp = Math.floor(now.getTime() / 1000).toString(),
  ) {
    const signature = createHmac('sha256', callbackSecret)
      .update(`${timestamp}.`)
      .update(raw)
      .digest('hex')
    return request(app())
      .post(`/api/v1/internal/upload-intents/${intentId}/complete`)
      .set('Content-Type', 'application/json')
      .set('X-Core-Timestamp', timestamp)
      .set('X-Core-Signature', signature)
      .send(raw)
  }

  async function complete(intent: { id: string; objectKey: string }, sha = 'a'.repeat(64)) {
    return signedCompletion(intent.id, {
      objectKey: intent.objectKey,
      sizeBytes: '10',
      sha256: sha,
    })
  }

  beforeAll(async () => prisma.$connect())

  beforeEach(async () => {
    now = new Date('2026-07-11T10:00:00.000Z')
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

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.quotaLedgerEntry.deleteMany()
    await prisma.quotaReservation.deleteMany()
    await prisma.uploadIntent.deleteMany()
    await prisma.file.deleteMany()
    await prisma.quotaAccount.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('ten identical authenticated callbacks return one immutable result', async () => {
    const user = await createUser('retry@example.test')
    const created = await createIntent(user, 'retry-ten', 'report.txt')
    expect(created.status).toBe(201)

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => complete(created.body)),
    )
    expect(responses.map((response) => ({ status: response.status, body: response.body }))).toEqual(
      responses.map((response) => ({ status: 200, body: response.body })),
    )
    const identities = new Set(
      responses.map((response) => `${response.body.fileId}:${response.body.versionId}`),
    )
    expect(identities.size).toBe(1)
    expect(responses.filter((response) => response.body.idempotent === false)).toHaveLength(1)
    expect(await prisma.fileVersion.count()).toBe(1)
    expect(await prisma.quotaLedgerEntry.count({ where: { businessRef: `upload-commit:${created.body.id}` } })).toBe(1)
    expect(await prisma.outboxEvent.count({ where: { topic: 'file.version.created' } })).toBe(1)
    expect(await prisma.uploadIntent.findUniqueOrThrow({ where: { id: created.body.id } })).toMatchObject({ status: 'completed' })
    expect(await prisma.quotaReservation.findUniqueOrThrow({ where: { uploadIntentId: created.body.id } })).toMatchObject({ status: 'committed' })
    expect(await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({ reservedBytes: 0n, committedBytes: 10n })
    const event = await prisma.outboxEvent.findFirstOrThrow()
    expect(event.dedupeKey).toBe(`file.version.created:${responses[0]?.body.versionId}`)
    expect(event.payload).toEqual({
      fileId: responses[0]?.body.fileId,
      versionId: responses[0]?.body.versionId,
      uploadIntentId: created.body.id,
      sizeBytes: '10',
      sha256: 'a'.repeat(64),
    })
  })

  test('authenticates exact raw callback bytes and rejects stale, missing, invalid and malformed fields', async () => {
    const user = await createUser('callback@example.test')
    const created = await createIntent(user, 'callback-auth', 'callback.txt')

    await request(app())
      .post(`/api/v1/internal/upload-intents/${created.body.id}/complete`)
      .set('Content-Type', 'application/json')
      .send('{"malformed":')
      .expect(401)
    await signedRawCompletion(created.body.id, '{"malformed":').expect(400)
    await request(app())
      .post(`/api/v1/internal/upload-intents/${created.body.id}/complete`)
      .send({ objectKey: created.body.objectKey, sizeBytes: '10', sha256: 'b'.repeat(64) })
      .expect(401)
    await signedCompletion(
      created.body.id,
      { objectKey: created.body.objectKey, sizeBytes: '10', sha256: 'b'.repeat(64) },
      Math.floor((now.getTime() - 301_000) / 1000).toString(),
    ).expect(401)
    await signedCompletion(
      created.body.id,
      { objectKey: created.body.objectKey, sizeBytes: '10', sha256: 'b'.repeat(64) },
      Math.floor((now.getTime() + 301_000) / 1000).toString(),
    ).expect(401)
    for (const offset of [-300_000, 300_000]) {
      const boundaryIntent = await createIntent(
        user,
        `callback-boundary-${offset}`,
        `callback-boundary-${offset}.txt`,
      )
      await signedCompletion(
        boundaryIntent.body.id,
        {
          objectKey: boundaryIntent.body.objectKey,
          sizeBytes: '10',
          sha256: 'f'.repeat(64),
        },
        Math.floor((now.getTime() + offset) / 1000).toString(),
      ).expect(200)
    }
    await signedCompletion(
      created.body.id,
      { objectKey: created.body.objectKey, sizeBytes: '10', sha256: 'b'.repeat(64) },
      undefined,
      'wrong-callback-secret-at-least-32-bytes',
    ).expect(401)

    for (const body of [
      { objectKey: created.body.objectKey, sizeBytes: 10, sha256: 'b'.repeat(64) },
      { objectKey: created.body.objectKey, sizeBytes: '01', sha256: 'b'.repeat(64) },
      { objectKey: created.body.objectKey, sizeBytes: '10', sha256: 'B'.repeat(64) },
      { objectKey: '', sizeBytes: '10', sha256: 'b'.repeat(64) },
    ]) {
      await signedCompletion(created.body.id, body).expect(400)
    }
    expect(
      await prisma.fileVersion.count({ where: { uploadIntentId: created.body.id } }),
    ).toBe(0)
    expect(await prisma.fileVersion.count()).toBe(2)
  })

  test('changed authenticated replay conflicts without changing committed accounting', async () => {
    const user = await createUser('changed@example.test')
    const created = await createIntent(user, 'changed-replay', 'changed.txt')
    await complete(created.body).then((response) => expect(response.status).toBe(200))
    await signedCompletion(created.body.id, {
      objectKey: created.body.objectKey,
      sizeBytes: '10',
      sha256: 'c'.repeat(64),
    }).expect(409)
    await signedCompletion(created.body.id, {
      objectKey: randomUUID(),
      sizeBytes: '10',
      sha256: 'a'.repeat(64),
    }).expect(409)
    await signedCompletion(created.body.id, {
      objectKey: created.body.objectKey,
      sizeBytes: '11',
      sha256: 'a'.repeat(64),
    }).expect(409)
    expect(await prisma.fileVersion.count()).toBe(1)
    expect(await prisma.outboxEvent.count()).toBe(1)
    expect(await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({ reservedBytes: 0n, committedBytes: 10n })
  })

  test('two concurrent same-name finalizations admit exactly one live sibling', async () => {
    const user = await createUser('same-name@example.test')
    const first = await createIntent(user, 'same-a', 'CaseFold.TXT')
    const second = await createIntent(user, 'same-b', 'casefold.txt')
    const responses = await Promise.all([complete(first.body), complete(second.body)])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    expect(await prisma.file.count({ where: { ownerId: user.id, deletedAt: null } })).toBe(1)
    expect(await prisma.fileVersion.count()).toBe(1)
    const loserIntentId = responses[0]?.status === 409 ? first.body.id : second.body.id
    expect(await prisma.uploadIntent.findUniqueOrThrow({ where: { id: loserIntentId } })).toMatchObject({ status: 'created' })
    expect(await prisma.quotaReservation.findUniqueOrThrow({ where: { uploadIntentId: loserIntentId } })).toMatchObject({ status: 'reserved' })
    expect(await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({ reservedBytes: 10n, committedBytes: 10n })
  })

  test('replacement intents are owner-bound, idempotent and allocate consecutive versions', async () => {
    const owner = await createUser('replace-owner@example.test')
    const other = await createUser('replace-other@example.test')
    const initial = await createIntent(owner, 'replace-initial', 'replace.txt')
    const completed = await complete(initial.body)
    expect(completed.status).toBe(200)

    await createReplacementIntent(other, completed.body.fileId, 'not-owner').then((response) => {
      expect(response.status).toBe(404)
    })
    const first = await createReplacementIntent(owner, completed.body.fileId, 'replacement-a')
    expect(first.status).toBe(201)
    const retry = await createReplacementIntent(owner, completed.body.fileId, 'replacement-a')
    expect(retry.status).toBe(200)
    expect(retry.body.id).toBe(first.body.id)
    await createReplacementIntent(owner, completed.body.fileId, 'replacement-a', '11').then((response) => {
      expect(response.status).toBe(409)
    })
    await prisma.file.update({ where: { id: completed.body.fileId }, data: { deletedAt: now } })
    await createReplacementIntent(owner, completed.body.fileId, 'replacement-a').then((response) => {
      expect(response.status).toBe(404)
    })
    await prisma.file.update({ where: { id: completed.body.fileId }, data: { deletedAt: null } })
    const second = await createReplacementIntent(owner, completed.body.fileId, 'replacement-b')
    expect(second.status).toBe(201)
    now = new Date('2026-07-11T10:05:00.000Z')
    const replacements = await Promise.all([
      complete(first.body, 'd'.repeat(64)),
      complete(second.body, 'e'.repeat(64)),
    ])
    expect(replacements.map((response) => response.status)).toEqual([200, 200])

    const versions = await prisma.fileVersion.findMany({
      where: { fileId: completed.body.fileId },
      orderBy: { version: 'asc' },
    })
    expect(versions.map((version) => version.version)).toEqual([1, 2, 3])
    expect(versions.map((version) => version.objectKey)).toHaveLength(3)
    expect(new Set(versions.map((version) => version.objectKey)).size).toBe(3)
    const listed = await request(app())
      .get('/api/v1/files?parentId=null')
      .set('Authorization', `Bearer ${token(owner)}`)
      .expect(200)
    expect(listed.body.items[0]).toMatchObject({
      id: completed.body.fileId,
      updatedAt: now.toISOString(),
      currentVersion: {
        id: versions[2]?.id,
        version: 3,
        sizeBytes: '10',
        mimeType: 'text/plain',
        sha256: versions[2]?.sha256,
      },
    })
  })

  test('cancel/finalize race has exactly one terminal reservation outcome', async () => {
    const user = await createUser('cancel-race@example.test')
    const created = await createIntent(user, 'cancel-race', 'race.txt')
    const [completion, cancellation] = await Promise.all([
      complete(created.body),
      request(app())
        .post(`/api/v1/upload-intents/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${token(user)}`),
    ])
    expect([200, 409]).toContain(completion.status)
    expect([204, 409]).toContain(cancellation.status)
    const reservation = await prisma.quotaReservation.findUniqueOrThrow({
      where: { uploadIntentId: created.body.id },
    })
    expect(['committed', 'released']).toContain(reservation.status)
    const account = await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })
    expect(account.reservedBytes).toBe(0n)
    expect(account.committedBytes).toBe(reservation.status === 'committed' ? 10n : 0n)
  })
})

describe('completion conflict recovery', () => {
  test('returns an already committed matching version after a P2002 race', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('unique conflict', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: ['uploadIntentId'] },
    })
    const existing = {
      id: 'version-1',
      fileId: 'file-1',
      objectKey: '11111111-1111-4111-8111-111111111111',
      sizeBytes: 10n,
      sha256: 'a'.repeat(64),
    }
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(conflict),
      fileVersion: { findUnique: vi.fn().mockResolvedValue(existing) },
    } as unknown as PrismaClient

    await expect(
      completeUploadIntent({
        prisma,
        intentId: '22222222-2222-4222-8222-222222222222',
        completion: {
          objectKey: existing.objectKey,
          sizeBytes: existing.sizeBytes,
          sha256: existing.sha256,
        },
        now: new Date('2026-07-11T10:00:00.000Z'),
      }),
    ).resolves.toEqual({ fileId: 'file-1', versionId: 'version-1', idempotent: true })
  })
})
