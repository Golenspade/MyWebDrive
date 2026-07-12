import Credential, { Config as CredentialConfig } from '@alicloud/credentials'
import DmClient, {
  SingleSendMailRequest,
  SingleSendMailRequestTemplate,
} from '@alicloud/dm20151123'
import { Config as OpenApiConfig } from '@alicloud/openapi-client'
import { RuntimeOptions } from '@alicloud/tea-util'

function unwrapCommonJsDefault<T>(value: T): T {
  const nestedDefault = (value as { default?: unknown }).default
  return (typeof nestedDefault === 'function' ? nestedDefault : value) as T
}

const CredentialClient = unwrapCommonJsDefault(Credential)
const DirectMailSdkClient = unwrapCommonJsDefault(DmClient)

export type SendOtpInput = {
  to: string
  code: string
  ttlSeconds: 600
  purpose: 'login'
}

export interface OtpMailer {
  sendOtp(input: SendOtpInput): Promise<void>
}

export interface DirectMailClient {
  singleSendMailWithOptions(
    request: SingleSendMailRequest,
    runtime: RuntimeOptions,
  ): Promise<unknown>
}

type CredentialOptions = {
  type: 'ecs_ram_role'
  roleName: string
  disableIMDSv1: boolean
}

type TemporaryCredential = {
  getCredential(): Promise<unknown>
}

type DirectMailClientOptions = {
  credential: TemporaryCredential
  endpoint: string
  regionId: string
}

type CreateDirectMailClientOptions = {
  roleName: string
  disableImdsV1: boolean
  endpoint: string
  regionId: string
  credentialFactory?: (options: CredentialOptions) => TemporaryCredential
  clientFactory?: (options: DirectMailClientOptions) => DirectMailClient
}

function defaultCredentialFactory(options: CredentialOptions): Credential {
  return new CredentialClient(new CredentialConfig(options))
}

function defaultClientFactory(options: DirectMailClientOptions): DirectMailClient {
  return new DirectMailSdkClient(new OpenApiConfig({
    credential: options.credential as Credential,
    endpoint: options.endpoint,
    regionId: options.regionId,
  }))
}

export function createDirectMailRuntime(
  options: CreateDirectMailClientOptions,
): { client: DirectMailClient; checkReady: () => Promise<void> } {
  const credentialFactory = options.credentialFactory ?? defaultCredentialFactory
  const clientFactory = options.clientFactory ?? defaultClientFactory
  const credential = credentialFactory({
    type: 'ecs_ram_role',
    roleName: options.roleName,
    disableIMDSv1: options.disableImdsV1,
  })

  const client = clientFactory({
    credential,
    endpoint: options.endpoint,
    regionId: options.regionId,
  })
  return {
    client,
    checkReady: async () => {
      await credential.getCredential()
    },
  }
}

export function createDirectMailOtpMailer(options: {
  client: DirectMailClient
  accountName: string
  templateId: string
}): OtpMailer {
  return {
    async sendOtp(input) {
      const request = new SingleSendMailRequest({
        accountName: options.accountName,
        addressType: 1,
        fromAlias: 'MyWebDrive',
        replyToAddress: false,
        subject: '【MyWebDrive】登录验证码',
        toAddress: input.to,
        template: new SingleSendMailRequestTemplate({
          templateId: options.templateId,
          templateData: { code: input.code },
        }),
      })
      const runtime = new RuntimeOptions({
        autoretry: false,
        maxAttempts: 1,
        connectTimeout: 5_000,
        readTimeout: 10_000,
      })

      await options.client.singleSendMailWithOptions(request, runtime)
    },
  }
}
