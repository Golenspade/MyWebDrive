export type CoreConfig = {
  nodeEnv: string
  port: number
  databaseUrl: string
  redisUrl: string
  sessionSecret: string
  otpPepper: string
  storageGrantSecret: string
  callbackSecret: string
  emailProviderUrl: string
  emailProviderToken: string
  defaultUserQuotaBytes: bigint
}

type Environment = Record<string, string | undefined>
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n

const DEVELOPMENT_DEFAULTS = {
  sessionSecret: 'development-only-core-session-secret',
  otpPepper: 'development-only-otp-pepper',
  storageGrantSecret: 'development-only-storage-grant-secret',
  callbackSecret: 'development-only-core-callback-secret',
} as const

const DEVELOPMENT_SECRET_VALUES = new Set<string>(Object.values(DEVELOPMENT_DEFAULTS))

function requireProductionSecret(env: Environment, key: string): string {
  const value = env[key]
  if (!value) throw new Error(`${key} must be set`)
  if (Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error(`${key} must be at least 32 UTF-8 bytes`)
  }
  if (DEVELOPMENT_SECRET_VALUES.has(value)) {
    throw new Error(`${key} must not use a development default`)
  }
  return value
}

function requireProductionValue(env: Environment, key: string): string {
  const value = env[key]
  if (!value) throw new Error(`${key} must be set`)
  return value
}

function requireProductionEmailUrl(env: Environment): string {
  const value = env.EMAIL_PROVIDER_URL
  if (!value) throw new Error('EMAIL_PROVIDER_URL must be set')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('EMAIL_PROVIDER_URL must be an absolute HTTPS URL')
  }
  if (url.protocol !== 'https:') {
    throw new Error('EMAIL_PROVIDER_URL must be an absolute HTTPS URL')
  }
  return url.toString().replace(/\/$/, '')
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '8080')
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('CORE_PORT must be an integer between 1 and 65535')
  }
  return port
}

function parseDefaultUserQuotaBytes(value: string | undefined): bigint {
  if (value === undefined || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error('DEFAULT_USER_QUOTA_BYTES must be a nonnegative decimal integer')
  }
  const parsed = BigInt(value)
  if (parsed > MAX_DATABASE_BIGINT) {
    throw new Error('DEFAULT_USER_QUOTA_BYTES must be a nonnegative decimal integer')
  }
  return parsed
}

export function loadCoreConfig(env: Environment = process.env): CoreConfig {
  const nodeEnv = env.NODE_ENV ?? 'development'
  const production = nodeEnv === 'production'

  const sessionSecret = production
    ? requireProductionSecret(env, 'CORE_SESSION_SECRET')
    : env.CORE_SESSION_SECRET ?? DEVELOPMENT_DEFAULTS.sessionSecret
  const otpPepper = production
    ? requireProductionSecret(env, 'OTP_PEPPER')
    : env.OTP_PEPPER ?? DEVELOPMENT_DEFAULTS.otpPepper
  const storageGrantSecret = production
    ? requireProductionSecret(env, 'STORAGE_GRANT_SECRET')
    : env.STORAGE_GRANT_SECRET ?? DEVELOPMENT_DEFAULTS.storageGrantSecret
  const callbackSecret = production
    ? requireProductionSecret(env, 'CORE_CALLBACK_SECRET')
    : env.CORE_CALLBACK_SECRET ?? DEVELOPMENT_DEFAULTS.callbackSecret
  const emailProviderUrl = production
    ? requireProductionEmailUrl(env)
    : env.EMAIL_PROVIDER_URL ?? 'http://127.0.0.1:8025'
  const emailProviderToken = production
    ? requireProductionValue(env, 'EMAIL_PROVIDER_TOKEN')
    : env.EMAIL_PROVIDER_TOKEN ?? 'development-only-email-token'

  return {
    nodeEnv,
    port: parsePort(env.CORE_PORT),
    databaseUrl:
      env.CORE_DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/mywebdrive_core?schema=public',
    redisUrl: env.REDIS_URL ?? 'redis://127.0.0.1:6379/0',
    sessionSecret,
    otpPepper,
    storageGrantSecret,
    callbackSecret,
    emailProviderUrl,
    emailProviderToken,
    defaultUserQuotaBytes: parseDefaultUserQuotaBytes(env.DEFAULT_USER_QUOTA_BYTES),
  }
}
