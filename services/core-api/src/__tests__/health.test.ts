import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../app.js'
import { loadCoreConfig } from '../config.js'

function fakes(overrides: { databaseReady?: boolean; redisReady?: boolean } = {}): CoreDependencies {
  const databaseReady = overrides.databaseReady ?? true
  const redisReady = overrides.redisReady ?? true

  return {
    prisma: {
      $queryRawUnsafe: vi.fn(async () => {
        if (!databaseReady) throw new Error('database unavailable')
        return [{ '?column?': 1 }]
      }),
    } as unknown as CoreDependencies['prisma'],
    redis: {
      ping: vi.fn(async () => {
        if (!redisReady) throw new Error('redis unavailable')
        return 'PONG'
      }),
    } as unknown as CoreDependencies['redis'],
    emailSender: { sendOtp: vi.fn(async () => undefined) },
    now: () => new Date('2026-07-11T00:00:00.000Z'),
    randomBytes: (size) => Buffer.alloc(size),
  }
}

describe('Core API health', () => {
  test('ready returns 503 when PostgreSQL is unavailable', async () => {
    const app = createCoreApp(fakes({ databaseReady: false }))
    expect((await request(app).get('/ready')).status).toBe(503)
  })

  test('ready returns 503 when Redis is unavailable', async () => {
    const app = createCoreApp(fakes({ redisReady: false }))
    expect((await request(app).get('/ready')).status).toBe(503)
  })

  test('live and ready identify the Core API', async () => {
    const app = createCoreApp(fakes())

    await request(app).get('/live').expect(200, { status: 'live', service: 'core-api' })
    await request(app).get('/ready').expect(200, { status: 'ready', service: 'core-api' })
  })

  test('version exposes build metadata', async () => {
    const app = createCoreApp(fakes())
    await request(app).get('/version').expect(200, {
      gitSha: 'unknown',
      buildId: 'local',
      startedAt: '2026-07-11T00:00:00.000Z',
    })
  })
})

describe('Core configuration', () => {
  test('production rejects missing OTP and session secrets', () => {
    expect(() => loadCoreConfig({ NODE_ENV: 'production' })).toThrow(
      'CORE_SESSION_SECRET must be set',
    )
  })

  test('production rejects development secret defaults', () => {
    expect(() =>
      loadCoreConfig({
        NODE_ENV: 'production',
        CORE_SESSION_SECRET: 'development-only-core-session-secret',
        OTP_PEPPER: 'a'.repeat(32),
        STORAGE_GRANT_SECRET: 'b'.repeat(32),
        CORE_CALLBACK_SECRET: 'c'.repeat(32),
        EMAIL_PROVIDER_URL: 'https://email.example.test',
        EMAIL_PROVIDER_TOKEN: 'provider-token',
      }),
    ).toThrow('CORE_SESSION_SECRET must not use a development default')
  })
})
