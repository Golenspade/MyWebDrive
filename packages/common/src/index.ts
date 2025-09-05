export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function err(code: string, message: string, details?: Record<string, unknown>): Result<never> {
  return { ok: false, error: { code, message, details } }
}

export function getEnv(key: string, fallback?: string): string {
  const v = process.env[key]
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing required env: ${key}`)
  }
  return v
}

export function requireEnvs(keys: string[]): void {
  const missing = keys.filter((k) => !process.env[k] || process.env[k] === '')
  if (missing.length) {
    throw new Error(`Missing required envs: ${missing.join(', ')}`)
  }
}

