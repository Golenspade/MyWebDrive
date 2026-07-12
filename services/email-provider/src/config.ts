export type EmailProviderConfig = {
  nodeEnv: string
  port: number
  serviceToken: string
  roleName: 'MyWebDriveDirectMailRole'
  disableImdsV1: true
  endpoint: 'dm.aliyuncs.com'
  regionId: 'cn-hangzhou'
  accountName: 'no-reply@mygoavemujica.top'
  templateId: '436289'
}

type Environment = Record<string, string | undefined>

const ROLE_NAME = 'MyWebDriveDirectMailRole' as const
const DEVELOPMENT_TOKEN = 'development-only-provider-token-0000'

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '8090')
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('EMAIL_PROVIDER_PORT must be an integer between 1 and 65535')
  }
  return port
}

function requireServiceToken(env: Environment, production: boolean): string {
  const token = env.EMAIL_PROVIDER_TOKEN ?? (production ? '' : DEVELOPMENT_TOKEN)
  if (!token) throw new Error('EMAIL_PROVIDER_TOKEN must be set')
  if (production && Buffer.byteLength(token, 'utf8') < 32) {
    throw new Error('EMAIL_PROVIDER_TOKEN must be at least 32 UTF-8 bytes')
  }
  return token
}

export function loadEmailProviderConfig(
  env: Environment = process.env,
): EmailProviderConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  const production = nodeEnv === 'production'

  if (env.ALIBABA_CLOUD_ACCESS_KEY_ID || env.ALIBABA_CLOUD_ACCESS_KEY_SECRET) {
    throw new Error('persistent AccessKey credentials are forbidden')
  }

  const roleName = env.ALIBABA_CLOUD_ECS_METADATA ?? ROLE_NAME
  if (roleName !== ROLE_NAME) {
    throw new Error(`ALIBABA_CLOUD_ECS_METADATA must be ${ROLE_NAME}`)
  }

  const imdsV1Disabled = env.ALIBABA_CLOUD_IMDSV1_DISABLE ?? 'true'
  if (imdsV1Disabled !== 'true') {
    throw new Error('ALIBABA_CLOUD_IMDSV1_DISABLE must be true')
  }

  return {
    nodeEnv,
    port: parsePort(env.EMAIL_PROVIDER_PORT),
    serviceToken: requireServiceToken(env, production),
    roleName,
    disableImdsV1: true,
    endpoint: 'dm.aliyuncs.com',
    regionId: 'cn-hangzhou',
    accountName: 'no-reply@mygoavemujica.top',
    templateId: '436289',
  }
}
