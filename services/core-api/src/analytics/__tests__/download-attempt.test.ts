import { createHmac, randomUUID } from 'node:crypto'

import { PrismaClient } from '@prisma/client'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  createDownloadAttempt,
  createDownloadAttemptCallbackRouter,
  DownloadAttemptConflictError,
  markStaleDownloadAttemptsUnknown,
  recordDownloadCompleted,
  recordDownloadStarted,
} from '../download-attempt.js'

const databaseUrl = process.env.CORE_TEST_DATABASE_URL
const integration = describe.runIf(Boolean(databaseUrl))
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl ?? 'postgresql://postgres:postgres@127.0.0.1:55432/mwd_download?schema=public',
    },
  },
})

integration('durable download attempts', () => {
  async function createVersion(sizeBytes = 5n) {
    const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.test` } })
    const file = await prisma.file.create({
      data: { ownerId: user.id, name: 'download.bin', type: 'file' },
    })
    const intent = await prisma.uploadIntent.create({
      data: {
        userId: user.id,
        idempotencyKey: randomUUID(),
        objectKey: randomUUID(),
        fileName: file.name,
        sizeBytes,
        mimeType: 'application/octet-stream',
        status: 'completed',
        expiresAt: new Date('2026-07-13T00:00:00.000Z'),
      },
    })
    return prisma.fileVersion.create({
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
  }

  beforeAll(async () => prisma.$connect())
  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany()
    await prisma.downloadAttempt.deleteMany()
    await prisma.analyticsCoverage.deleteMany()
    await prisma.fileVersion.deleteMany()
    await prisma.uploadIntent.deleteMany()
    await prisma.file.deleteMany()
    await prisma.user.deleteMany()
  })
  afterAll(async () => prisma.$disconnect())

  test('moves issued to started to completed and creates one completion event', async () => {
    const version = await createVersion()
    const issuedAt = new Date('2026-07-12T10:00:00.000Z')
    const startedAt = new Date('2026-07-12T10:00:01.000Z')
    const completedAt = new Date('2026-07-12T10:00:02.000Z')
    const attempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'private',
      expectedBytes: version.sizeBytes,
      now: issuedAt,
    })

    expect(attempt).toMatchObject({
      fileVersionId: version.id,
      purpose: 'private',
      expectedBytes: 5n,
      status: 'issued',
      issuedAt,
      startedAt: null,
      completedAt: null,
      unknownAt: null,
    })

    const started = await recordDownloadStarted({
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      expectedBytes: 5n,
      occurredAt: startedAt,
    })
    expect(started).toMatchObject({ status: 'started', startedAt, idempotent: false })

    const completed = await recordDownloadCompleted({
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      bytes: 5n,
      occurredAt: completedAt,
    })
    expect(completed).toMatchObject({ status: 'completed', completedAt, idempotent: false })

    const events = await prisma.outboxEvent.findMany()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      dedupeKey: `download.completed:${attempt.id}`,
      topic: 'download.completed',
      aggregateId: attempt.id,
      occurredAt: completedAt,
      payload: {
        downloadAttemptId: attempt.id,
        fileVersionId: version.id,
        sizeBytes: '5',
      },
    })
  })

  test('accepts duplicate start and completion without changing identity or duplicating Outbox', async () => {
    const version = await createVersion()
    const attempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'share',
      expectedBytes: 5n,
      now: new Date('2026-07-12T10:00:00.000Z'),
    })
    const startedAt = new Date('2026-07-12T10:00:01.000Z')
    const completedAt = new Date('2026-07-12T10:00:02.000Z')
    const startInput = {
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      expectedBytes: 5n,
      occurredAt: startedAt,
    }
    expect((await recordDownloadStarted(startInput)).idempotent).toBe(false)
    expect((await recordDownloadStarted(startInput)).idempotent).toBe(true)

    const completionInput = {
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      bytes: 5n,
      occurredAt: completedAt,
    }
    expect((await recordDownloadCompleted(completionInput)).idempotent).toBe(false)
    expect((await recordDownloadCompleted(completionInput)).idempotent).toBe(true)
    expect(await prisma.outboxEvent.count()).toBe(1)
  })

  test('accepts concurrent identical completions with exactly one Outbox event', async () => {
    const version = await createVersion()
    const attempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'private',
      expectedBytes: 5n,
      now: new Date('2026-07-12T10:00:00.000Z'),
    })
    await recordDownloadStarted({
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      expectedBytes: 5n,
      occurredAt: new Date('2026-07-12T10:00:01.000Z'),
    })
    const input = {
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      bytes: 5n,
      occurredAt: new Date('2026-07-12T10:00:02.000Z'),
    }
    const results = await Promise.all([
      recordDownloadCompleted(input),
      recordDownloadCompleted(input),
    ])
    expect(results.map((result) => result.idempotent).sort()).toEqual([false, true])
    expect(await prisma.outboxEvent.count()).toBe(1)
  })

  test.each([
    ['wrong start version', 'started', { fileVersionId: randomUUID(), expectedBytes: 5n }],
    ['wrong start bytes', 'started', { fileVersionId: null, expectedBytes: 4n }],
    ['wrong completion version', 'completed', { fileVersionId: randomUUID(), bytes: 5n }],
    ['wrong completion bytes', 'completed', { fileVersionId: null, bytes: 4n }],
  ] as const)('rejects %s without changing the attempt', async (_label, phase, mismatch) => {
    const version = await createVersion()
    const attempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'publication',
      expectedBytes: 5n,
      now: new Date('2026-07-12T10:00:00.000Z'),
    })
    if (phase === 'completed') {
      await recordDownloadStarted({
        prisma,
        attemptId: attempt.id,
        fileVersionId: version.id,
        expectedBytes: 5n,
        occurredAt: new Date('2026-07-12T10:00:01.000Z'),
      })
      await expect(recordDownloadCompleted({
        prisma,
        attemptId: attempt.id,
        fileVersionId: mismatch.fileVersionId ?? version.id,
        bytes: mismatch.bytes ?? 5n,
        occurredAt: new Date('2026-07-12T10:00:02.000Z'),
      })).rejects.toBeInstanceOf(DownloadAttemptConflictError)
    } else {
      await expect(recordDownloadStarted({
        prisma,
        attemptId: attempt.id,
        fileVersionId: mismatch.fileVersionId ?? version.id,
        expectedBytes: mismatch.expectedBytes ?? 5n,
        occurredAt: new Date('2026-07-12T10:00:01.000Z'),
      })).rejects.toBeInstanceOf(DownloadAttemptConflictError)
    }
    expect((await prisma.downloadAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status)
      .toBe(phase === 'started' ? 'issued' : 'started')
    expect(await prisma.outboxEvent.count()).toBe(0)
  })

  test('moves stale started attempts to unknown and preserves the earliest downloads coverage gap', async () => {
    const version = await createVersion()
    const attempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'private',
      expectedBytes: 5n,
      now: new Date('2026-07-12T10:00:00.000Z'),
    })
    const firstStartedAt = new Date('2026-07-12T10:00:01.000Z')
    await recordDownloadStarted({
      prisma,
      attemptId: attempt.id,
      fileVersionId: version.id,
      expectedBytes: 5n,
      occurredAt: firstStartedAt,
    })
    const unknownAt = new Date('2026-07-12T10:10:00.000Z')
    expect(await markStaleDownloadAttemptsUnknown({
      prisma,
      startedBefore: new Date('2026-07-12T10:05:00.000Z'),
      now: unknownAt,
    })).toBe(1)

    expect(await prisma.downloadAttempt.findUniqueOrThrow({ where: { id: attempt.id } }))
      .toMatchObject({ status: 'unknown', unknownAt, completedAt: null })
    expect(await prisma.analyticsCoverage.findUniqueOrThrow({ where: { metric: 'downloads' } }))
      .toMatchObject({
        startedAt: firstStartedAt,
        complete: false,
        gapStartedAt: firstStartedAt,
      })
    expect(await prisma.outboxEvent.count()).toBe(0)

    const laterAttempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'private',
      expectedBytes: 5n,
      now: new Date('2026-07-12T10:11:00.000Z'),
    })
    await recordDownloadStarted({
      prisma,
      attemptId: laterAttempt.id,
      fileVersionId: version.id,
      expectedBytes: 5n,
      occurredAt: new Date('2026-07-12T10:12:00.000Z'),
    })
    expect(await markStaleDownloadAttemptsUnknown({
      prisma,
      startedBefore: new Date('2026-07-12T10:15:00.000Z'),
      now: new Date('2026-07-12T10:20:00.000Z'),
    })).toBe(1)
    expect(await prisma.analyticsCoverage.findUniqueOrThrow({ where: { metric: 'downloads' } }))
      .toMatchObject({
        startedAt: firstStartedAt,
        complete: false,
        gapStartedAt: firstStartedAt,
      })
  })

  test('authenticates exact raw callback bytes on the private started and completed routes', async () => {
    const callbackSecret = 'download-callback-secret-at-least-32-bytes'
    const now = new Date('2026-07-12T10:00:10.000Z')
    const version = await createVersion()
    const attempt = await createDownloadAttempt({
      prisma,
      fileVersionId: version.id,
      purpose: 'private',
      expectedBytes: 5n,
      now: new Date('2026-07-12T10:00:00.000Z'),
    })
    const app = express()
    app.use(express.raw({ type: 'application/json' }))
    app.use((req, _res, next) => {
      if (Buffer.isBuffer(req.body)) req.rawBody = Buffer.from(req.body)
      next()
    })
    app.use('/api/v1', createDownloadAttemptCallbackRouter({
      prisma,
      callbackSecret,
      now: () => now,
    }))

    async function callback(phase: 'started' | 'completed', rawBody: string, secret = callbackSecret) {
      const timestamp = Math.floor(now.getTime() / 1000).toString()
      const signature = createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(Buffer.from(rawBody))
        .digest('hex')
      return request(app)
        .post(`/api/v1/internal/download-attempts/${attempt.id}/${phase}`)
        .set('Content-Type', 'application/json')
        .set('X-Core-Timestamp', timestamp)
        .set('X-Core-Signature', signature)
        .send(rawBody)
    }

    const startedBody = JSON.stringify({
      fileVersionId: version.id,
      expectedBytes: '5',
      occurredAt: '2026-07-12T10:00:01.000Z',
    }, null, 2)
    const completedBody = JSON.stringify({
      fileVersionId: version.id,
      bytes: '5',
      occurredAt: '2026-07-12T10:00:02.000Z',
    })
    await callback('completed', completedBody).then((response) => {
      expect(response.status).toBe(425)
      expect(response.body).toEqual({ error: 'download attempt not started yet' })
    })
    await callback('started', startedBody).then((response) => {
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ id: attempt.id, status: 'started', idempotent: false })
    })

    const changedWhitespace = JSON.stringify(JSON.parse(startedBody))
    const timestamp = Math.floor(now.getTime() / 1000).toString()
    const oldSignature = createHmac('sha256', callbackSecret)
      .update(`${timestamp}.`)
      .update(Buffer.from(startedBody))
      .digest('hex')
    await request(app)
      .post(`/api/v1/internal/download-attempts/${attempt.id}/started`)
      .set('Content-Type', 'application/json')
      .set('X-Core-Timestamp', timestamp)
      .set('X-Core-Signature', oldSignature)
      .send(changedWhitespace)
      .expect(401, { error: 'invalid callback identity' })

    await callback('completed', completedBody).then((response) => {
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ id: attempt.id, status: 'completed', idempotent: false })
    })
  })
})

test('re-reads a conditional-update loser and accepts the exact completed identity', async () => {
  const completedAt = new Date('2026-07-12T10:00:02.000Z')
  const started = {
    id: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
    fileVersionId: '16232aef-1f26-4bb4-98ba-ccc72d7f3915',
    expectedBytes: 5n,
    status: 'started',
    issuedAt: new Date('2026-07-12T10:00:00.000Z'),
    startedAt: new Date('2026-07-12T10:00:01.000Z'),
    completedAt: null,
    unknownAt: null,
    purpose: 'private',
  }
  const completed = { ...started, status: 'completed', completedAt }
  const tx = {
    downloadAttempt: {
      findUnique: vi.fn()
        .mockResolvedValueOnce(started)
        .mockResolvedValueOnce(completed),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    outboxEvent: { create: vi.fn() },
  }
  const prisma = {
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  } as unknown as PrismaClient

  await expect(recordDownloadCompleted({
    prisma,
    attemptId: started.id,
    fileVersionId: started.fileVersionId,
    bytes: 5n,
    occurredAt: completedAt,
  })).resolves.toMatchObject({ status: 'completed', completedAt, idempotent: true })
  expect(tx.outboxEvent.create).not.toHaveBeenCalled()
})
