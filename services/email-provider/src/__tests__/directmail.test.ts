import { describe, expect, test, vi } from 'vitest'

import {
  createDirectMailRuntime,
  createDirectMailOtpMailer,
  type DirectMailClient,
} from '../directmail.js'

describe('DirectMail client identity', () => {
  test('uses the ECS RAM role and regional DirectMail endpoint', async () => {
    const credential = {
      kind: 'temporary-credential',
      getCredential: vi.fn(async () => ({ securityToken: 'temporary' })),
    }
    const credentialFactory = vi.fn(() => credential)
    const sdkClient: DirectMailClient = {
      singleSendMailWithOptions: vi.fn(async () => undefined),
    }
    const clientFactory = vi.fn(() => sdkClient)

    const runtime = createDirectMailRuntime({
      roleName: 'MyWebDriveDirectMailRole',
      endpoint: 'dm.aliyuncs.com',
      regionId: 'cn-hangzhou',
      disableImdsV1: true,
      credentialFactory,
      clientFactory,
    })

    expect(runtime.client).toBe(sdkClient)

    expect(credentialFactory).toHaveBeenCalledExactlyOnceWith({
      type: 'ecs_ram_role',
      roleName: 'MyWebDriveDirectMailRole',
      disableIMDSv1: true,
    })
    expect(clientFactory).toHaveBeenCalledExactlyOnceWith({
      credential,
      endpoint: 'dm.aliyuncs.com',
      regionId: 'cn-hangzhou',
    })
    await expect(runtime.checkReady()).resolves.toBeUndefined()
    expect(credential.getCredential).toHaveBeenCalledTimes(1)
    expect(sdkClient.singleSendMailWithOptions).not.toHaveBeenCalled()
  })
})

describe('DirectMail OTP message', () => {
  test('sends one fixed transactional message without reply-to', async () => {
    const client: DirectMailClient = {
      singleSendMailWithOptions: vi.fn(async () => undefined),
    }
    const mailer = createDirectMailOtpMailer({
      client,
      accountName: 'no-reply@mygoavemujica.top',
      templateId: '436289',
    })

    await mailer.sendOtp({
      to: 'person@example.com',
      code: '123456',
      ttlSeconds: 600,
      purpose: 'login',
    })

    expect(client.singleSendMailWithOptions).toHaveBeenCalledTimes(1)
    const [message, runtime] = vi.mocked(client.singleSendMailWithOptions).mock.calls[0]!
    expect(message).toMatchObject({
      accountName: 'no-reply@mygoavemujica.top',
      addressType: 1,
      replyToAddress: false,
      toAddress: 'person@example.com',
      template: {
        templateId: '436289',
        templateData: { code: '123456' },
      },
    })
    expect(message.htmlBody).toBeUndefined()
    expect(message.textBody).toBeUndefined()
    expect(message.subject).toBeUndefined()
    expect(runtime).toMatchObject({
      autoretry: false,
      maxAttempts: 1,
      connectTimeout: 5_000,
      readTimeout: 10_000,
    })
  })

  test('does not retry a rejected send', async () => {
    const client: DirectMailClient = {
      singleSendMailWithOptions: vi.fn(async () => {
        throw new Error('rejected')
      }),
    }
    const mailer = createDirectMailOtpMailer({
      client,
      accountName: 'no-reply@mygoavemujica.top',
      templateId: '436289',
    })

    await expect(mailer.sendOtp({
      to: 'person@example.com',
      code: '123456',
      ttlSeconds: 600,
      purpose: 'login',
    })).rejects.toThrow('rejected')
    expect(client.singleSendMailWithOptions).toHaveBeenCalledTimes(1)
  })
})
