import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { isOpaqueObjectKey } from './local-object-path.js'

const STORAGE_GRANT_AUDIENCE = 'storage-api'
const STORAGE_GRANT_TYPE = 'storage-grant'
const MAX_GRANT_TTL_SECONDS = 300

export type StorageGrantPurpose = 'download' | 'upload'

export type StorageGrant = {
  jti: string
  objectKey: string
  purpose: StorageGrantPurpose
  audience: typeof STORAGE_GRANT_AUDIENCE
  expiresAt: Date
}

type SignStorageGrantInput = {
  objectKey: string
  purpose: StorageGrantPurpose
  ttlSeconds?: number
}

function invalidGrant(): Error {
  return new Error('Invalid storage grant')
}

function isGrantPurpose(value: unknown): value is StorageGrantPurpose {
  return value === 'download' || value === 'upload'
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function signStorageGrant(input: SignStorageGrantInput, secret: string): string {
  const ttlSeconds = input.ttlSeconds ?? 60

  if (!secret || !isOpaqueObjectKey(input.objectKey) || !isGrantPurpose(input.purpose)) throw invalidGrant()
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_GRANT_TTL_SECONDS) throw invalidGrant()

  return jwt.sign({
    typ: STORAGE_GRANT_TYPE,
    jti: randomUUID(),
    objectKey: input.objectKey,
    purpose: input.purpose,
  }, secret, {
    algorithm: 'HS256',
    audience: STORAGE_GRANT_AUDIENCE,
    expiresIn: ttlSeconds,
  })
}

export function verifyStorageGrant(token: string, secret: string, purpose: StorageGrantPurpose): StorageGrant {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      audience: STORAGE_GRANT_AUDIENCE,
    }) as jwt.JwtPayload

    if (payload.typ !== STORAGE_GRANT_TYPE || !isUuid(payload.jti) || !isOpaqueObjectKey(payload.objectKey)) throw invalidGrant()
    if (!isGrantPurpose(payload.purpose) || payload.purpose !== purpose || typeof payload.exp !== 'number') throw invalidGrant()

    return {
      jti: payload.jti,
      objectKey: payload.objectKey,
      purpose: payload.purpose,
      audience: STORAGE_GRANT_AUDIENCE,
      expiresAt: new Date(payload.exp * 1000),
    }
  } catch {
    throw invalidGrant()
  }
}
