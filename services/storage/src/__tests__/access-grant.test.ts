import jwt from 'jsonwebtoken'
import { describe, expect, test } from 'vitest'
import { signStorageGrant, verifyStorageGrant } from '../access-grant.js'

const secret = 'storage-grant-secret-that-is-long-enough-for-tests'
const objectKey = 'a'.repeat(64)

describe('storage grants', () => {
  test('accepts a purpose-bound download grant', () => {
    const token = signStorageGrant({ objectKey, purpose: 'download' }, secret)

    expect(verifyStorageGrant(token, secret, 'download')).toMatchObject({
      objectKey,
      purpose: 'download',
      audience: 'storage-api',
    })
  })

  test('rejects a user access token because its audience is not storage-api', () => {
    const token = jwt.sign({ user_id: 'u1', type: 'access' }, secret, { expiresIn: 60 })

    expect(() => verifyStorageGrant(token, secret, 'download')).toThrow('Invalid storage grant')
  })

  test('rejects an upload grant on a download request', () => {
    const token = signStorageGrant({ objectKey, purpose: 'upload' }, secret)

    expect(() => verifyStorageGrant(token, secret, 'download')).toThrow('Invalid storage grant')
  })

  test('rejects an expired grant', () => {
    const token = jwt.sign({
      typ: 'storage-grant',
      jti: 'a5f7f5be-9eb6-49cf-a1a5-dc6a5c09fe3a',
      objectKey,
      purpose: 'download',
    }, secret, {
      algorithm: 'HS256',
      audience: 'storage-api',
      expiresIn: -1,
    })

    expect(() => verifyStorageGrant(token, secret, 'download')).toThrow('Invalid storage grant')
  })
})
