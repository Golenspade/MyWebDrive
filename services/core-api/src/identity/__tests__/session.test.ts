import { createHmac } from 'node:crypto'

import { describe, expect, test, vi } from 'vitest'

import { issueAccessToken, verifyAccessToken } from '../../auth/access-token.js'

function signAccessToken(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'access' }), 'utf8').toString(
    'base64url',
  )
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signingInput = `${header}.${encodedPayload}`
  return `${signingInput}.${createHmac('sha256', secret).update(signingInput).digest('base64url')}`
}

describe('access JWT', () => {
  test('uses the required HS256 access header and 900-second claims', () => {
    const secret = 'access-token-test-secret-at-least-32-bytes'
    const token = issueAccessToken({ id: 'user-id', role: 'admin' }, secret)
    const [encodedHeader, encodedPayload] = token.split('.')
    const header = JSON.parse(Buffer.from(encodedHeader ?? '', 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(encodedPayload ?? '', 'base64url').toString('utf8'))

    expect(header).toEqual({ alg: 'HS256', typ: 'access' })
    expect(payload).toMatchObject({
      sub: 'user-id',
      role: 'admin',
      iss: 'mywebdrive-core',
      aud: 'mywebdrive-web',
    })
    expect(payload.exp - payload.iat).toBe(900)
    expect(verifyAccessToken(token, secret)).toEqual({ userId: 'user-id', role: 'admin' })
    expect(() => verifyAccessToken(`${token}tampered`, secret)).toThrow('invalid access token')
  })

  test.each([
    {
      label: 'iat beyond the allowed future skew',
      mutate: (payload: Record<string, unknown>, nowSeconds: number) => {
        payload.iat = nowSeconds + 31
        payload.exp = nowSeconds + 931
      },
    },
    {
      label: 'unsafe iat',
      mutate: (payload: Record<string, unknown>) => {
        payload.iat = Number.MAX_SAFE_INTEGER + 1
      },
    },
    {
      label: 'unsafe exp',
      mutate: (payload: Record<string, unknown>) => {
        payload.exp = Number.MAX_SAFE_INTEGER + 1
      },
    },
    {
      label: '901-second lifetime',
      mutate: (payload: Record<string, unknown>) => {
        payload.exp = Number(payload.iat) + 901
      },
    },
    {
      label: 'non-positive lifetime',
      mutate: (payload: Record<string, unknown>) => {
        payload.exp = payload.iat
      },
    },
    {
      label: 'far-future year',
      mutate: (payload: Record<string, unknown>) => {
        payload.iat = 4_102_444_800
        payload.exp = 4_102_445_700
      },
    },
  ])('rejects hand-signed access tokens with invalid NumericDate: $label', ({ mutate }) => {
    const now = new Date('2026-07-11T08:00:00.000Z')
    const nowSeconds = Math.floor(now.getTime() / 1000)
    const secret = 'access-token-test-secret-at-least-32-bytes'
    const payload: Record<string, unknown> = {
      sub: 'user-id',
      role: 'user',
      iss: 'mywebdrive-core',
      aud: 'mywebdrive-web',
      iat: nowSeconds,
      exp: nowSeconds + 900,
    }
    mutate(payload, nowSeconds)
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    try {
      expect(() => verifyAccessToken(signAccessToken(payload, secret), secret)).toThrow(
        'invalid access token',
      )
    } finally {
      dateNow.mockRestore()
    }
  })
})
