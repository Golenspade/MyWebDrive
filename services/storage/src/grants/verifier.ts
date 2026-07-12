import { createHmac, timingSafeEqual } from 'node:crypto'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const DOWNLOAD_PURPOSES = new Set([
  'download-private',
  'download-share',
  'download-publication',
] as const)
const MAX_GRANT_SECONDS = 300
const CLOCK_SKEW_SECONDS = 30
const MAX_DATABASE_BIGINT = 9_223_372_036_854_775_807n

type DownloadPurpose = 'download-private' | 'download-share' | 'download-publication'

export type UploadGrant = {
  purpose: 'upload'
  objectKey: string
  uploadIntentId: string
  maxBytes: bigint
  jti: string
  iat: number
  exp: number
}

export type DownloadGrant = {
  purpose: DownloadPurpose
  objectKey: string
  downloadAttemptId: string
  fileVersionId: string
  expectedBytes: bigint
  jti: string
  iat: number
  exp: number
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(): never {
  throw new Error('invalid storage grant')
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

export function verifyStorageGrant(
  token: string,
  secret: string,
  expected: 'upload' | 'download',
  now = new Date(),
): UploadGrant | DownloadGrant {
  const pieces = token.split('.')
  const [encodedHeader, encodedPayload, encodedSignature] = pieces
  if (
    !secret ||
    pieces.length !== 3 ||
    !encodedHeader ||
    !encodedPayload ||
    !encodedSignature ||
    !SIGNATURE_PATTERN.test(encodedSignature)
  ) invalid()

  let header: unknown
  let payload: unknown
  try {
    header = decodeJson(encodedHeader)
    payload = decodeJson(encodedPayload)
  } catch {
    invalid()
  }
  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()
  const supplied = Buffer.from(encodedSignature, 'base64url')
  if (
    supplied.length !== expectedSignature.length ||
    !timingSafeEqual(supplied, expectedSignature) ||
    !record(header) ||
    header.alg !== 'HS256' ||
    header.typ !== 'storage-grant' ||
    !record(payload) ||
    payload.aud !== 'storage-api' ||
    !UUID_PATTERN.test(String(payload.objectKey)) ||
    !UUID_PATTERN.test(String(payload.jti)) ||
    typeof payload.iat !== 'number' ||
    !Number.isSafeInteger(payload.iat) ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp)
  ) invalid()

  const nowSeconds = Math.floor(now.getTime() / 1000)
  if (
    payload.iat > nowSeconds + CLOCK_SKEW_SECONDS ||
    payload.exp <= payload.iat ||
    payload.exp > payload.iat + MAX_GRANT_SECONDS ||
    payload.exp > nowSeconds + MAX_GRANT_SECONDS + CLOCK_SKEW_SECONDS ||
    payload.exp <= nowSeconds
  ) invalid()

  const common = {
    objectKey: String(payload.objectKey),
    jti: String(payload.jti),
    iat: payload.iat,
    exp: payload.exp,
  }
  if (expected === 'upload') {
    if (
      payload.purpose !== 'upload' ||
      !UUID_PATTERN.test(String(payload.uploadIntentId)) ||
      typeof payload.maxBytes !== 'string' ||
      !POSITIVE_INTEGER_PATTERN.test(payload.maxBytes) ||
      payload.downloadAttemptId !== undefined ||
      payload.fileVersionId !== undefined ||
      payload.expectedBytes !== undefined
    ) invalid()
    return {
      ...common,
      purpose: 'upload',
      uploadIntentId: String(payload.uploadIntentId),
      maxBytes: BigInt(payload.maxBytes),
    }
  }
  if (
    typeof payload.purpose !== 'string' ||
    !DOWNLOAD_PURPOSES.has(payload.purpose as DownloadPurpose) ||
    !UUID_PATTERN.test(String(payload.downloadAttemptId)) ||
    !UUID_PATTERN.test(String(payload.fileVersionId)) ||
    typeof payload.expectedBytes !== 'string' ||
    !/^(0|[1-9]\d*)$/.test(payload.expectedBytes) ||
    BigInt(payload.expectedBytes) > MAX_DATABASE_BIGINT ||
    payload.uploadIntentId !== undefined ||
    payload.maxBytes !== undefined
  ) invalid()
  return {
    ...common,
    purpose: payload.purpose as DownloadPurpose,
    downloadAttemptId: String(payload.downloadAttemptId),
    fileVersionId: String(payload.fileVersionId),
    expectedBytes: BigInt(payload.expectedBytes),
  }
}
