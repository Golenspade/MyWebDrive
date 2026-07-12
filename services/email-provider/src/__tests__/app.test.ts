import request from 'supertest'
import { describe, expect, test, vi } from 'vitest'

import { createEmailProviderApp } from '../app.js'
import { loadEmailProviderConfig } from '../config.js'
import type { OtpMailer } from '../directmail.js'

const validPayload = {
  to: 'person@example.com',
  code: '123456',
  ttlSeconds: 600,
  purpose: 'login',
} as const

function createMailer(): OtpMailer {
  return { sendOtp: vi.fn(async () => undefined) }
}

describe('email provider boundary', () => {
  test.each([
    undefined,
    '',
    'Bearer wrong-token',
    'Basic internal-token',
  ])('rejects an invalid service identity without sending (%s)', async (authorization) => {
    const mailer = createMailer()
    const app = createEmailProviderApp({ mailer, serviceToken: 'internal-token' })
    const call = request(app).post('/v1/messages/otp').send(validPayload)
    if (authorization !== undefined) call.set('Authorization', authorization)

    const response = await call.expect(401)

    expect(mailer.sendOtp).not.toHaveBeenCalled()
    expect(JSON.stringify(response.body)).not.toContain(validPayload.to)
    expect(JSON.stringify(response.body)).not.toContain(validPayload.code)
  })

  test.each([
    [{ ...validPayload, to: 'not-an-email' }, 'recipient'],
    [{ ...validPayload, code: '12345' }, 'code'],
    [{ ...validPayload, code: 'abcdef' }, 'code'],
    [{ ...validPayload, ttlSeconds: 601 }, 'ttl'],
    [{ ...validPayload, purpose: 'signup' }, 'purpose'],
  ])('rejects malformed OTP payload %#', async (payload, _label) => {
    const mailer = createMailer()
    const app = createEmailProviderApp({ mailer, serviceToken: 'internal-token' })

    const response = await request(app)
      .post('/v1/messages/otp')
      .set('Authorization', 'Bearer internal-token')
      .send(payload)
      .expect(400)

    expect(mailer.sendOtp).not.toHaveBeenCalled()
    expect(JSON.stringify(response.body)).not.toContain(String(payload.to))
    expect(JSON.stringify(response.body)).not.toContain(String(payload.code))
  })

  test('accepts one valid OTP request', async () => {
    const mailer = createMailer()
    const app = createEmailProviderApp({ mailer, serviceToken: 'internal-token' })

    await request(app)
      .post('/v1/messages/otp')
      .set('Authorization', 'Bearer internal-token')
      .send(validPayload)
      .expect(204)

    expect(mailer.sendOtp).toHaveBeenCalledExactlyOnceWith(validPayload)
  })

  test('returns a redacted provider failure', async () => {
    const mailer: OtpMailer = {
      sendOtp: vi.fn(async () => {
        throw Object.assign(
          new Error(`provider rejected ${validPayload.to} ${validPayload.code}`),
          {
            code: 'InvalidParameter.Template',
            statusCode: 400,
            requestId: 'sensitive-request-id',
          },
        )
      }),
    }
    const errorReporter = vi.fn()
    const app = createEmailProviderApp({
      mailer,
      serviceToken: 'internal-token',
      reportError: errorReporter,
    })

    const response = await request(app)
      .post('/v1/messages/otp')
      .set('Authorization', 'Bearer internal-token')
      .send(validPayload)
      .expect(503)

    expect(response.body).toEqual({ error: 'email delivery unavailable' })
    expect(errorReporter).toHaveBeenCalledExactlyOnceWith({
      event: 'directmail_send_failed',
      code: 'InvalidParameter.Template',
      statusCode: 400,
    })
    expect(JSON.stringify(response.body)).not.toContain(validPayload.to)
    expect(JSON.stringify(response.body)).not.toContain(validPayload.code)
    expect(JSON.stringify(errorReporter.mock.calls)).not.toContain(validPayload.to)
    expect(JSON.stringify(errorReporter.mock.calls)).not.toContain(validPayload.code)
    expect(JSON.stringify(errorReporter.mock.calls)).not.toContain('sensitive-request-id')
    expect(JSON.stringify(errorReporter.mock.calls)).not.toContain('provider rejected')
  })

  test('drops unsafe provider diagnostic fields', async () => {
    const mailer: OtpMailer = {
      sendOtp: vi.fn(async () => {
        throw {
          code: `Rejected:${validPayload.to}`,
          statusCode: '400',
          message: validPayload.code,
        }
      }),
    }
    const errorReporter = vi.fn()
    const app = createEmailProviderApp({
      mailer,
      serviceToken: 'internal-token',
      reportError: errorReporter,
    })

    await request(app)
      .post('/v1/messages/otp')
      .set('Authorization', 'Bearer internal-token')
      .send(validPayload)
      .expect(503)

    expect(errorReporter).toHaveBeenCalledExactlyOnceWith({
      event: 'directmail_send_failed',
    })
  })

  test('keeps live process-only and gates ready on the ECS credential', async () => {
    const checkReady = vi.fn(async () => undefined)
    const app = createEmailProviderApp({
      mailer: createMailer(),
      serviceToken: 'internal-token',
      checkReady,
    })

    await request(app).get('/live').expect(200, {
      status: 'live',
      service: 'email-provider',
    })
    await request(app).get('/ready').expect(200, {
      status: 'ready',
      service: 'email-provider',
    })
    expect(checkReady).toHaveBeenCalledTimes(1)
  })

  test('ready fails closed when the ECS RAM credential is unavailable', async () => {
    const app = createEmailProviderApp({
      mailer: createMailer(),
      serviceToken: 'internal-token',
      checkReady: vi.fn(async () => {
        throw new Error('metadata unavailable')
      }),
    })

    await request(app).get('/live').expect(200)
    await request(app).get('/ready').expect(503, {
      status: 'not_ready',
      service: 'email-provider',
    })
  })
})

describe('email provider configuration', () => {
  test('uses the approved DirectMail identity and ECS RAM role', () => {
    const config = loadEmailProviderConfig({
      NODE_ENV: 'production',
      EMAIL_PROVIDER_TOKEN: 't'.repeat(32),
      ALIBABA_CLOUD_ECS_METADATA: 'MyWebDriveDirectMailRole',
      ALIBABA_CLOUD_IMDSV1_DISABLE: 'true',
    })

    expect(config).toMatchObject({
      port: 8090,
      accountName: 'no-reply@mygoavemujica.top',
      endpoint: 'dm.aliyuncs.com',
      regionId: 'cn-hangzhou',
      roleName: 'MyWebDriveDirectMailRole',
      templateId: '436289',
      disableImdsV1: true,
    })
  })

  test.each([
    ['ALIBABA_CLOUD_ACCESS_KEY_ID', 'example-id'],
    ['ALIBABA_CLOUD_ACCESS_KEY_SECRET', 'example-secret'],
  ])('production rejects persistent credential variable %s', (key, value) => {
    expect(() => loadEmailProviderConfig({
      NODE_ENV: 'production',
      EMAIL_PROVIDER_TOKEN: 't'.repeat(32),
      ALIBABA_CLOUD_ECS_METADATA: 'MyWebDriveDirectMailRole',
      ALIBABA_CLOUD_IMDSV1_DISABLE: 'true',
      [key]: value,
    })).toThrow('persistent AccessKey credentials are forbidden')
  })

  test('production requires a 32-byte internal token', () => {
    expect(() => loadEmailProviderConfig({
      NODE_ENV: 'production',
      EMAIL_PROVIDER_TOKEN: 'too-short',
      ALIBABA_CLOUD_ECS_METADATA: 'MyWebDriveDirectMailRole',
      ALIBABA_CLOUD_IMDSV1_DISABLE: 'true',
    })).toThrow('EMAIL_PROVIDER_TOKEN must be at least 32 UTF-8 bytes')
  })

  test('production requires IMDSv2-only credentials', () => {
    expect(() => loadEmailProviderConfig({
      NODE_ENV: 'production',
      EMAIL_PROVIDER_TOKEN: 't'.repeat(32),
      ALIBABA_CLOUD_ECS_METADATA: 'MyWebDriveDirectMailRole',
      ALIBABA_CLOUD_IMDSV1_DISABLE: 'false',
    })).toThrow('ALIBABA_CLOUD_IMDSV1_DISABLE must be true')
  })
})
