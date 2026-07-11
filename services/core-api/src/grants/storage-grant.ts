import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const AUDIENCE = 'storage-api'
const MAX_GRANT_SECONDS = 300
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PURPOSES = new Set<string>([
  'upload',
  'download-private',
  'download-share',
  'download-publication',
])

export type StorageGrantPurpose =
  | 'upload'
  | 'download-private'
  | 'download-share'
  | 'download-publication'

type UploadGrantInput = {
  purpose: 'upload'
  objectKey: string
  uploadIntentId: string
  maxBytes: bigint
  now: Date
  expiresAt: Date
  secret: string
}

type DownloadGrantInput = {
  purpose: Exclude<StorageGrantPurpose, 'upload'>
  objectKey: string
  now: Date
  expiresAt: Date
  secret: string
}

export type StorageGrantInput = UploadGrantInput | DownloadGrantInput

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decode(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

function signature(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function invalidInput(): never {
  throw new Error('invalid storage grant input')
}

export function issueStorageGrant(input: StorageGrantInput): string {
  if (!PURPOSES.has(input.purpose) || !UUID_PATTERN.test(input.objectKey) || !input.secret) {
    invalidInput()
  }
  if (input.purpose === 'upload') {
    if (!UUID_PATTERN.test(input.uploadIntentId) || input.maxBytes <= 0n) invalidInput()
  }

  const issuedAt = Math.floor(input.now.getTime() / 1000)
  const expiresAt = Math.min(
    issuedAt + MAX_GRANT_SECONDS,
    Math.floor(input.expiresAt.getTime() / 1000),
  )
  if (!Number.isSafeInteger(issuedAt) || expiresAt <= issuedAt) invalidInput()

  const header = encode({ alg: 'HS256', typ: 'storage-grant' })
  const payload = encode({
    aud: AUDIENCE,
    purpose: input.purpose,
    objectKey: input.objectKey,
    ...(input.purpose === 'upload'
      ? {
          uploadIntentId: input.uploadIntentId,
          maxBytes: input.maxBytes.toString(),
        }
      : {}),
    jti: randomUUID(),
    iat: issuedAt,
    exp: expiresAt,
  })
  const signingInput = `${header}.${payload}`
  return `${signingInput}.${signature(signingInput, input.secret).toString('base64url')}`
}

export function verifyStorageGrant(
  token: string,
  secret: string,
  now: Date = new Date(),
): Record<string, unknown> {
  const parts = token.split('.')
  const [encodedHeader, encodedPayload, encodedSignature] = parts
  if (parts.length !== 3 || !encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('invalid storage grant')
  }

  let header: unknown
  let payload: unknown
  let presented: Buffer
  try {
    header = decode(encodedHeader)
    payload = decode(encodedPayload)
    presented = Buffer.from(encodedSignature, 'base64url')
  } catch {
    throw new Error('invalid storage grant')
  }

  const expected = signature(`${encodedHeader}.${encodedPayload}`, secret)
  if (
    presented.length !== expected.length ||
    !timingSafeEqual(presented, expected) ||
    !isRecord(header) ||
    header.alg !== 'HS256' ||
    header.typ !== 'storage-grant' ||
    !isRecord(payload) ||
    payload.aud !== AUDIENCE ||
    typeof payload.purpose !== 'string' ||
    !PURPOSES.has(payload.purpose) ||
    !UUID_PATTERN.test(String(payload.objectKey)) ||
    !UUID_PATTERN.test(String(payload.jti)) ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(now.getTime() / 1000) ||
    payload.exp > payload.iat + MAX_GRANT_SECONDS
  ) {
    throw new Error('invalid storage grant')
  }
  if (
    payload.purpose === 'upload' &&
    (!UUID_PATTERN.test(String(payload.uploadIntentId)) ||
      typeof payload.maxBytes !== 'string' ||
      !/^[1-9]\d*$/.test(payload.maxBytes))
  ) {
    throw new Error('invalid storage grant')
  }
  return payload
}
