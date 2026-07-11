import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../app.js'
import { loadCoreConfig } from '../config.js'

const REQUIRED_PRODUCTION_SECRETS = [
  {
    key: 'CORE_SESSION_SECRET',
    developmentDefault: 'development-only-core-session-secret',
  },
  { key: 'OTP_PEPPER', developmentDefault: 'development-only-otp-pepper' },
  {
    key: 'STORAGE_GRANT_SECRET',
    developmentDefault: 'development-only-storage-grant-secret',
  },
  {
    key: 'CORE_CALLBACK_SECRET',
    developmentDefault: 'development-only-core-callback-secret',
  },
] as const

type ProductionEnvironment = Record<string, string | undefined>

function productionEnvironment(): ProductionEnvironment {
  return {
    NODE_ENV: 'production',
    CORE_SESSION_SECRET: 's'.repeat(32),
    OTP_PEPPER: 'o'.repeat(32),
    STORAGE_GRANT_SECRET: 'g'.repeat(32),
    CORE_CALLBACK_SECRET: 'c'.repeat(32),
    EMAIL_PROVIDER_URL: 'https://email.example.test',
    EMAIL_PROVIDER_TOKEN: 'provider-token',
  }
}

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

describe('Core callback raw body', () => {
  test('retains internal upload completion bytes exactly', async () => {
    const app = createCoreApp(fakes())
    const callbackBody = '{\n  "objectKey": "opaque/测试",\n  "sizeBytes": "42"\n}\n'
    const expectedBytes = Buffer.from(callbackBody, 'utf8')

    app.post('/api/v1/internal/upload-intents/intent-123/complete', (req, res) => {
      res.json({ rawBody: req.rawBody?.toString('base64') ?? null })
    })

    const response = await request(app)
      .post('/api/v1/internal/upload-intents/intent-123/complete')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(callbackBody)
      .expect(200)

    expect(Buffer.from(response.body.rawBody, 'base64')).toEqual(expectedBytes)
  })

  test('does not retain raw bytes for non-completion JSON routes', async () => {
    const app = createCoreApp(fakes())

    app.post('/api/v1/internal/upload-intents/intent-123/cancel', (req, res) => {
      res.json({ retainedRawBody: req.rawBody !== undefined })
    })

    await request(app)
      .post('/api/v1/internal/upload-intents/intent-123/cancel')
      .send({ reason: 'user-requested' })
      .expect(200, { retainedRawBody: false })
  })
})

describe('Core configuration', () => {
  test.each(REQUIRED_PRODUCTION_SECRETS)(
    'production rejects missing $key',
    ({ key }) => {
      const env = productionEnvironment()
      delete env[key]

      expect(() => loadCoreConfig(env)).toThrow(`${key} must be set`)
    },
  )

  test.each(REQUIRED_PRODUCTION_SECRETS)(
    'production rejects $key shorter than 32 UTF-8 bytes',
    ({ key }) => {
      const env = productionEnvironment()
      const shortUtf8Secret = `${'é'.repeat(15)}a`
      expect(Buffer.byteLength(shortUtf8Secret, 'utf8')).toBe(31)
      env[key] = shortUtf8Secret

      expect(() => loadCoreConfig(env)).toThrow(`${key} must be at least 32 UTF-8 bytes`)
    },
  )

  test.each(REQUIRED_PRODUCTION_SECRETS)(
    'production rejects the known $key development default',
    ({ key, developmentDefault }) => {
      const env = productionEnvironment()
      env[key] = developmentDefault

      expect(() => loadCoreConfig(env)).toThrow()
    },
  )

  test.each([undefined, ''])(
    'production rejects missing or empty EMAIL_PROVIDER_TOKEN (%s)',
    (token) => {
      const env = productionEnvironment()
      env.EMAIL_PROVIDER_TOKEN = token

      expect(() => loadCoreConfig(env)).toThrow('EMAIL_PROVIDER_TOKEN must be set')
    },
  )

  test.each([
    { label: 'missing', value: undefined },
    { label: 'relative', value: 'email.example.test/v1/messages/otp' },
    { label: 'non-HTTPS', value: 'http://email.example.test' },
  ])('production rejects $label EMAIL_PROVIDER_URL', ({ value }) => {
    const env = productionEnvironment()
    env.EMAIL_PROVIDER_URL = value

    expect(() => loadCoreConfig(env)).toThrow()
  })

  test('production accepts a nonempty provider token with an absolute HTTPS URL', () => {
    const config = loadCoreConfig(productionEnvironment())

    expect(config.emailProviderToken).toBe('provider-token')
    expect(config.emailProviderUrl).toBe('https://email.example.test')
  })
})
