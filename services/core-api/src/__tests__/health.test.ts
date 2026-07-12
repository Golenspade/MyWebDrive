import { createAppTelemetry } from '@mywebdrive/observability'
import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createCoreApp, type CoreDependencies } from '../app.js'
import { loadAnalyticsWorkerConfig, loadCoreConfig } from '../config.js'

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
    EMAIL_PROVIDER_TOKEN: 'p'.repeat(32),
    DEFAULT_USER_QUOTA_BYTES: '10737418240',
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

  test('exposes private Prometheus metrics without authentication', async () => {
    const response = await request(createCoreApp(fakes())).get('/metrics').expect(200)

    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.text).toContain('http_requests_total')
  })

  test('registers upload metrics and records readiness dependencies independently', async () => {
    const telemetry = createAppTelemetry({ service: 'core-api' })
    const app = createCoreApp({ ...fakes({ databaseReady: false }), telemetry })

    await request(app).get('/ready').expect(503)
    const metrics = await request(app).get('/metrics').expect(200)

    expect(metrics.text).toContain('upload_finalizations_total')
    expect(metrics.text).toMatch(/dependency_ready\{[^}]*dependency="postgres"[^}]*\} 0/)
    expect(metrics.text).toMatch(/dependency_ready\{[^}]*dependency="redis"[^}]*\} 1/)
  })

  test('mounts both administrator Dashboard domains', async () => {
    const app = createCoreApp(fakes())

    await request(app).get('/api/v1/admin/dashboard/business?range=7d').expect(401)
    await request(app).get('/api/v1/admin/dashboard/system?range=7d').expect(401)
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

  test.each(['started', 'completed'] as const)(
    'retains internal download %s callback bytes exactly',
    async (phase) => {
      const app = createCoreApp(fakes())
      const callbackBody = '{\n  "fileVersionId": "opaque-version",\n  "bytes": "42"\n}\n'
      const expectedBytes = Buffer.from(callbackBody, 'utf8')

      app.post(`/api/v1/internal/download-attempts/attempt-123/${phase}`, (req, res) => {
        res.json({ rawBody: req.rawBody?.toString('base64') ?? null })
      })

      const response = await request(app)
        .post(`/api/v1/internal/download-attempts/attempt-123/${phase}`)
        .set('Content-Type', 'application/json; charset=utf-8')
        .send(callbackBody)
        .expect(200)

      expect(Buffer.from(response.body.rawBody, 'base64')).toEqual(expectedBytes)
    },
  )
})

describe('Core configuration', () => {
  test('loads the analytics worker with only its least-privilege environment', () => {
    expect(loadAnalyticsWorkerConfig({
      NODE_ENV: 'production',
      CORE_DATABASE_URL: 'postgresql://worker@example.test/core',
      ANALYTICS_WORKER_PORT: '8081',
    })).toEqual({
      nodeEnv: 'production',
      databaseUrl: 'postgresql://worker@example.test/core',
      port: 8081,
    })
  })

  test.each(['0', '65536', '1.5', 'nope'])(
    'rejects invalid ANALYTICS_WORKER_PORT %s',
    (port) => {
      expect(() => loadAnalyticsWorkerConfig({ ANALYTICS_WORKER_PORT: port })).toThrow(
        'ANALYTICS_WORKER_PORT must be an integer between 1 and 65535',
      )
    },
  )

  test.each([
    ['CORE_SESSION_SECRET', 'OTP_PEPPER'],
    ['CORE_SESSION_SECRET', 'STORAGE_GRANT_SECRET'],
    ['CORE_SESSION_SECRET', 'CORE_CALLBACK_SECRET'],
    ['OTP_PEPPER', 'STORAGE_GRANT_SECRET'],
    ['OTP_PEPPER', 'CORE_CALLBACK_SECRET'],
    ['STORAGE_GRANT_SECRET', 'CORE_CALLBACK_SECRET'],
  ] as const)('production rejects equal %s and %s', (left, right) => {
    const env = productionEnvironment()
    env[right] = env[left]
    expect(() => loadCoreConfig(env)).toThrow('production secrets must be distinct')
  })

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
    { label: 'external HTTP', value: 'http://email.example.test' },
    { label: 'private HTTP with path', value: 'http://email-provider:8090/other' },
  ])('production rejects $label EMAIL_PROVIDER_URL', ({ value }) => {
    const env = productionEnvironment()
    env.EMAIL_PROVIDER_URL = value

    expect(() => loadCoreConfig(env)).toThrow()
  })

  test('production accepts a 32-byte provider token with an absolute HTTPS URL', () => {
    const config = loadCoreConfig(productionEnvironment())

    expect(config.emailProviderToken).toBe('p'.repeat(32))
    expect(config.emailProviderUrl).toBe('https://email.example.test')
    expect(config.defaultUserQuotaBytes).toBe(10_737_418_240n)
  })

  test('production accepts the exact private email-provider origin', () => {
    const env = productionEnvironment()
    env.EMAIL_PROVIDER_URL = 'http://email-provider:8090'

    expect(loadCoreConfig(env).emailProviderUrl).toBe('http://email-provider:8090')
  })

  test('production rejects a provider token shorter than 32 UTF-8 bytes', () => {
    const env = productionEnvironment()
    env.EMAIL_PROVIDER_TOKEN = 'too-short'

    expect(() => loadCoreConfig(env)).toThrow(
      'EMAIL_PROVIDER_TOKEN must be at least 32 UTF-8 bytes',
    )
  })

  test.each([
    undefined,
    '',
    '-1',
    '+1',
    '1.5',
    ' 1',
    '1 ',
    '01',
    'abc',
    '9223372036854775808',
  ])(
    'rejects a missing or non-canonical DEFAULT_USER_QUOTA_BYTES (%s)',
    (value) => {
      const env = productionEnvironment()
      env.DEFAULT_USER_QUOTA_BYTES = value
      expect(() => loadCoreConfig(env)).toThrow(
        'DEFAULT_USER_QUOTA_BYTES must be a nonnegative decimal integer',
      )
    },
  )

  test('accepts an explicit zero DEFAULT_USER_QUOTA_BYTES', () => {
    const env = productionEnvironment()
    env.DEFAULT_USER_QUOTA_BYTES = '0'
    expect(loadCoreConfig(env).defaultUserQuotaBytes).toBe(0n)
  })
})
