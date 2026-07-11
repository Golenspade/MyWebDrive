import { createHmac, timingSafeEqual } from 'node:crypto'

const ISSUER = 'mywebdrive-core'
const AUDIENCE = 'mywebdrive-web'
const ACCESS_TOKEN_SECONDS = 900
const CLOCK_SKEW_SECONDS = 30

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

function signature(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function issueAccessToken(user: { id: string; role: string }, secret: string): string {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encodeJson({ alg: 'HS256', typ: 'access' })
  const payload = encodeJson({
    sub: user.id,
    role: user.role,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + ACCESS_TOKEN_SECONDS,
  })
  const signingInput = `${header}.${payload}`
  return `${signingInput}.${signature(signingInput, secret).toString('base64url')}`
}

export function verifyAccessToken(
  token: string,
  secret: string,
): { userId: string; role: string } {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid access token')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('invalid access token')
  }

  let header: unknown
  let payload: unknown
  let presentedSignature: Buffer
  try {
    header = decodeJson(encodedHeader)
    payload = decodeJson(encodedPayload)
    presentedSignature = Buffer.from(encodedSignature, 'base64url')
  } catch {
    throw new Error('invalid access token')
  }

  const expectedSignature = signature(`${encodedHeader}.${encodedPayload}`, secret)
  if (
    presentedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(presentedSignature, expectedSignature)
  ) {
    throw new Error('invalid access token')
  }
  if (!isRecord(header) || header.alg !== 'HS256' || header.typ !== 'access') {
    throw new Error('invalid access token')
  }
  if (
    !isRecord(payload) ||
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    payload.iss !== ISSUER ||
    payload.aud !== AUDIENCE ||
    typeof payload.iat !== 'number' ||
    !Number.isSafeInteger(payload.iat) ||
    typeof payload.exp !== 'number' ||
    !Number.isSafeInteger(payload.exp)
  ) {
    throw new Error('invalid access token')
  }

  const now = Math.floor(Date.now() / 1000)
  if (
    payload.iat > now + CLOCK_SKEW_SECONDS ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat !== ACCESS_TOKEN_SECONDS ||
    payload.exp <= now
  ) {
    throw new Error('invalid access token')
  }

  return { userId: payload.sub, role: payload.role }
}
