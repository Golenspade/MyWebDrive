import { randomUUID } from 'node:crypto'

import { Prisma, PrismaClient } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../../app.js'
import { issueAccessToken } from '../../auth/access-token.js'
import { runSerializable } from '../service.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const sessionSecret = 'upload-test-session-secret-at-least-32-bytes'
const grantSecret = 'upload-test-grant-secret-at-least-32-bytes'

integration('quota reservations and upload intents', () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          databaseUrl ??
          'postgresql://postgres:postgres@127.0.0.1:5432/mwd_task4?schema=public',
      },
    },
  })
  let now = new Date('2026-07-11T08:00:00.000Z')
  const redis = { ping: vi.fn(async () => 'PONG') } as unknown as CoreDependencies['redis']

  function app() {
    return createCoreApp({
      prisma,
      redis,
      emailSender: { sendOtp: vi.fn(async () => undefined) },
      now: () => now,
      randomBytes: (size) => Buffer.alloc(size, 4),
      identity: {
        sessionSecret,
        otpPepper: 'upload-test-otp-pepper',
        adminEmails: '',
        production: false,
        defaultUserQuotaBytes: 100n,
      },
      storage: { grantSecret },
    })
  }

  function token(user: { id: string; role: string }): string {
    return issueAccessToken(user, sessionSecret)
  }

  async function createUser(input: {
    email: string
    role?: string
    status?: string
    limit?: bigint
    reserved?: bigint
    committed?: bigint
  }) {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        role: input.role ?? 'user',
        status: input.status ?? 'active',
      },
    })
    await prisma.quotaAccount.create({
      data: {
        userId: user.id,
        limitBytes: input.limit ?? 100n,
        reservedBytes: input.reserved ?? 0n,
        committedBytes: input.committed ?? 0n,
      },
    })
    return user
  }

  async function postIntent(
    user: { id: string; role: string },
    idempotencyKey: string,
    body: Record<string, unknown>,
  ) {
    return request(app())
      .post('/api/v1/upload-intents')
      .set('Authorization', `Bearer ${token(user)}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(body)
  }

  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    now = new Date('2026-07-11T08:00:00.000Z')
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
    await prisma.$disconnect()
  })

  test('concurrent 80-byte reservations on a 100-byte account admit exactly one', async () => {
    const user = await createUser({ email: 'race@example.test' })
    const body = { fileName: 'report.pdf', sizeBytes: '80', mimeType: 'application/pdf' }

    const responses = await Promise.all([
      postIntent(user, 'race-a', body),
      postIntent(user, 'race-b', body),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([201, 413])

    const winnerIndex = responses.findIndex((response) => response.status === 201)
    const winner = responses[winnerIndex]
    const winnerKey = winnerIndex === 0 ? 'race-a' : 'race-b'
    if (!winner) throw new Error('missing winning response')
    expect(winner.body).toMatchObject({
      id: expect.any(String),
      objectKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      uploadGrant: expect.any(String),
      expiresAt: expect.any(String),
    })
    expect(winner.body.objectKey).not.toContain('report')

    const retry = await postIntent(user, winnerKey, body)
    expect(retry.status).toBe(200)
    expect(retry.body.id).toBe(winner.body.id)
    expect(retry.body.objectKey).toBe(winner.body.objectKey)

    await postIntent(user, winnerKey, { ...body, sizeBytes: '79' }).then((response) => {
      expect(response.status).toBe(409)
      expect(response.body).toEqual({ error: 'idempotency key conflict' })
    })

    expect(await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({
      limitBytes: 100n,
      reservedBytes: 80n,
      committedBytes: 0n,
    })
    const reservation = await prisma.quotaReservation.findFirstOrThrow({
      where: { userId: user.id },
    })
    expect(await prisma.quotaReservation.count({ where: { userId: user.id } })).toBe(1)
    expect(
      await prisma.quotaLedgerEntry.count({
        where: { businessRef: `reservation-create:${reservation.id}` },
      }),
    ).toBe(1)
  })

  test('drains more than one bounded expiry batch before reserving new quota', async () => {
    const user = await createUser({
      email: 'expiry-batches@example.test',
      limit: 1000n,
      reserved: 51n,
    })
    const expiredAt = new Date(now.getTime() - 1)
    for (let index = 0; index < 51; index += 1) {
      const intent = await prisma.uploadIntent.create({
        data: {
          userId: user.id,
          idempotencyKey: `expired-${index}`,
          objectKey: randomUUID(),
          fileName: `expired-${index}.bin`,
          sizeBytes: 1n,
          mimeType: 'application/octet-stream',
          expiresAt: expiredAt,
        },
      })
      await prisma.quotaReservation.create({
        data: {
          userId: user.id,
          uploadIntentId: intent.id,
          bytes: 1n,
          expiresAt: expiredAt,
        },
      })
    }

    const response = await postIntent(user, 'after-expiry-drain', {
      fileName: 'full-quota.bin',
      sizeBytes: '1000',
      mimeType: 'application/octet-stream',
    })
    expect(response.status).toBe(201)
    expect(
      await prisma.quotaReservation.count({ where: { userId: user.id, status: 'expired' } }),
    ).toBe(51)
    expect(
      await prisma.quotaLedgerEntry.count({
        where: { userId: user.id, businessRef: { startsWith: 'reservation-release:' } },
      }),
    ).toBe(51)
    expect(
      await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: user.id } }),
    ).toMatchObject({ limitBytes: 1000n, reservedBytes: 1000n, committedBytes: 0n })
  })

  test('returns quota exceeded instead of overflowing at the PostgreSQL BIGINT boundary', async () => {
    const max = 9_223_372_036_854_775_807n
    const user = await createUser({
      email: 'bigint-boundary@example.test',
      limit: max,
      committed: max,
    })

    const response = await postIntent(user, 'bigint-boundary', {
      fileName: 'one-more-byte.bin',
      sizeBytes: '1',
      mimeType: 'application/octet-stream',
    })
    expect(response.status).toBe(413)
    expect(response.body).toEqual({ error: 'quota exceeded' })
    expect(await prisma.uploadIntent.count({ where: { userId: user.id } })).toBe(0)
  })

  test('serializes quota JSON as decimal strings and validates admin quota changes against occupancy', async () => {
    const user = await createUser({
      email: 'quota-user@example.test',
      limit: 9007199254740993000n,
      reserved: 20n,
      committed: 30n,
    })
    const admin = await createUser({ email: 'quota-admin@example.test', role: 'admin' })

    await request(app())
      .get('/api/v1/quota')
      .set('Authorization', `Bearer ${token(user)}`)
      .expect(200, {
        limitBytes: '9007199254740993000',
        reservedBytes: '20',
        committedBytes: '30',
        availableBytes: '9007199254740992950',
      })

    const lowered = await request(app())
      .patch(`/api/v1/admin/users/${user.id}/quota`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .send({ limitBytes: '49' })
    expect(lowered.status).toBe(409)
    expect(lowered.body).toEqual({ error: 'quota limit below current usage' })

    await request(app())
      .patch(`/api/v1/admin/users/${user.id}/quota`)
      .set('Authorization', `Bearer ${token(admin)}`)
      .send({ limitBytes: '50' })
      .expect(200, {
        limitBytes: '50',
        reservedBytes: '20',
        committedBytes: '30',
        availableBytes: '0',
      })

    for (const limitBytes of ['-1', '01', '9223372036854775808', 60]) {
      await request(app())
        .patch(`/api/v1/admin/users/${user.id}/quota`)
        .set('Authorization', `Bearer ${token(admin)}`)
        .send({ limitBytes })
        .expect(400, { error: 'invalid quota limit' })
    }
  })

  test('uses current database status and role for access decisions', async () => {
    const disabled = await createUser({
      email: 'disabled-upload@example.test',
      status: 'disabled',
    })
    const normal = await createUser({ email: 'normal-upload@example.test' })
    const target = await createUser({ email: 'target-upload@example.test' })

    await request(app()).get('/api/v1/quota').expect(401, { error: 'invalid access token' })
    await request(app())
      .get('/api/v1/quota')
      .set('Authorization', 'Bearer invalid')
      .expect(401, { error: 'invalid access token' })
    await request(app())
      .get('/api/v1/quota')
      .set('Authorization', `Bearer ${token(disabled)}`)
      .expect(401, { error: 'invalid access token' })
    await request(app())
      .patch(`/api/v1/admin/users/${target.id}/quota`)
      .set('Authorization', `Bearer ${token({ id: normal.id, role: 'admin' })}`)
      .send({ limitBytes: '100' })
      .expect(403, { error: 'admin access required' })
  })

  test.each([
    { key: '', body: { fileName: 'ok', sizeBytes: '1', mimeType: 'text/plain' } },
    { key: 'bad key', body: { fileName: 'ok', sizeBytes: '1', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: '../bad', sizeBytes: '1', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'bad\\name', sizeBytes: '1', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'bad\u0001name', sizeBytes: '1', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'ok', sizeBytes: '0', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'ok', sizeBytes: '-1', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'ok', sizeBytes: '01', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'ok', sizeBytes: '9223372036854775808', mimeType: 'text/plain' } },
    { key: 'valid', body: { fileName: 'ok', sizeBytes: '1', mimeType: '' } },
  ])('rejects invalid upload input %#', async ({ key, body }) => {
    const user = await createUser({ email: `validation-${randomUUID()}@example.test` })
    const call = request(app())
      .post('/api/v1/upload-intents')
      .set('Authorization', `Bearer ${token(user)}`)
      .send(body)
    if (key) call.set('Idempotency-Key', key)
    const response = await call
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'invalid upload intent' })
  })

  test('requires an owned, undeleted folder when parentId is provided', async () => {
    const owner = await createUser({ email: 'parent-owner@example.test', limit: 10n })
    const other = await createUser({ email: 'parent-other@example.test', limit: 10n })
    const folder = await prisma.file.create({
      data: { ownerId: owner.id, name: 'folder', type: 'folder' },
    })
    const regularFile = await prisma.file.create({
      data: { ownerId: owner.id, name: 'file', type: 'file' },
    })
    const deletedFolder = await prisma.file.create({
      data: { ownerId: owner.id, name: 'deleted', type: 'folder', deletedAt: now },
    })

    await postIntent(owner, 'parent-ok', {
      fileName: 'child.txt', sizeBytes: '1', mimeType: 'text/plain', parentId: folder.id,
    }).then((response) => expect(response.status).toBe(201))

    for (const [index, parentId] of [regularFile.id, deletedFolder.id, randomUUID()].entries()) {
      await postIntent(owner, `parent-invalid-${index}`, {
        fileName: 'child.txt', sizeBytes: '1', mimeType: 'text/plain', parentId,
      }).then((response) => expect(response.status).toBe(400))
    }
    await postIntent(other, 'parent-other-owner', {
      fileName: 'child.txt', sizeBytes: '1', mimeType: 'text/plain', parentId: folder.id,
    }).then((response) => expect(response.status).toBe(400))
  })

  test('owner cancel and lazy expiry release reservations exactly once under races', async () => {
    const owner = await createUser({ email: 'release-owner@example.test', limit: 100n })
    const other = await createUser({ email: 'release-other@example.test', limit: 100n })
    const created = await postIntent(owner, 'cancel-once', {
      fileName: 'cancel.txt', sizeBytes: '20', mimeType: 'text/plain',
    })
    expect(created.status).toBe(201)

    await request(app())
      .post(`/api/v1/upload-intents/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token(other)}`)
      .expect(404, { error: 'upload intent not found' })

    const cancellations = await Promise.all([
      request(app()).post(`/api/v1/upload-intents/${created.body.id}/cancel`).set('Authorization', `Bearer ${token(owner)}`),
      request(app()).post(`/api/v1/upload-intents/${created.body.id}/cancel`).set('Authorization', `Bearer ${token(owner)}`),
    ])
    expect(cancellations.map((response) => response.status)).toEqual([204, 204])

    const cancelledReservation = await prisma.quotaReservation.findUniqueOrThrow({
      where: { uploadIntentId: created.body.id },
    })
    expect(cancelledReservation.status).toBe('released')
    expect(
      await prisma.quotaLedgerEntry.count({
        where: { businessRef: `reservation-release:${cancelledReservation.id}` },
      }),
    ).toBe(1)
    expect((await prisma.quotaAccount.findUniqueOrThrow({ where: { userId: owner.id } })).reservedBytes).toBe(0n)

    const expiring = await postIntent(owner, 'expire-once', {
      fileName: 'expire.txt', sizeBytes: '30', mimeType: 'text/plain',
    })
    expect(expiring.status).toBe(201)
    now = new Date('2026-07-11T09:00:00.000Z')
    const reads = await Promise.all([
      request(app()).get('/api/v1/quota').set('Authorization', `Bearer ${token(owner)}`),
      request(app()).get('/api/v1/quota').set('Authorization', `Bearer ${token(owner)}`),
    ])
    expect(reads.map((response) => response.status)).toEqual([200, 200])
    expect(reads[0]?.body.reservedBytes).toBe('0')
    const expiredReservation = await prisma.quotaReservation.findUniqueOrThrow({
      where: { uploadIntentId: expiring.body.id },
    })
    expect(expiredReservation.status).toBe('expired')
    expect(
      await prisma.quotaLedgerEntry.count({
        where: { businessRef: `reservation-release:${expiredReservation.id}` },
      }),
    ).toBe(1)
  })
})

describe('serializable retry', () => {
  test('retries Prisma P2034 conflicts before succeeding', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('write conflict', {
      code: 'P2034',
      clientVersion: '5.19.1',
    })
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce('ok')
    const prisma = { $transaction: transaction } as unknown as PrismaClient

    await expect(runSerializable(prisma, async () => 'ok')).resolves.toBe('ok')
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  test('retries PostgreSQL 40001 conflicts reported through Prisma raw queries', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('raw write conflict', {
      code: 'P2010',
      clientVersion: '5.19.1',
      meta: { code: '40001' },
    })
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce('ok')
    const prisma = { $transaction: transaction } as unknown as PrismaClient

    await expect(runSerializable(prisma, async () => 'ok')).resolves.toBe('ok')
    expect(transaction).toHaveBeenCalledTimes(2)
  })
})
