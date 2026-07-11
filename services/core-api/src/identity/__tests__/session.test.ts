import { describe, expect, test } from 'vitest'

import { issueAccessToken, verifyAccessToken } from '../../auth/access-token.js'

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
})
