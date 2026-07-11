import { createHmac } from 'node:crypto'

import { describe, expect, test } from 'vitest'

import { issueStorageGrant, verifyStorageGrant } from '../storage-grant.js'

function decodePart(token: string, index: number): Record<string, unknown> {
  const value = token.split('.')[index]
  if (!value) throw new Error('missing token part')
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>
}

describe('storage grants', () => {
  test('issues the exact upload grant contract with an independent secret', () => {
    const now = new Date('2026-07-11T08:00:00.000Z')
    const secret = 'storage-grant-test-secret-at-least-32-bytes'
    const token = issueStorageGrant({
      purpose: 'upload',
      objectKey: '5dd0d998-ec26-4fbd-9589-eca8aa9a9311',
      uploadIntentId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
      maxBytes: 80n,
      now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      secret,
    })

    const header = decodePart(token, 0)
    const payload = decodePart(token, 1)
    expect(header).toEqual({ alg: 'HS256', typ: 'storage-grant' })
    expect(payload).toMatchObject({
      aud: 'storage-api',
      purpose: 'upload',
      objectKey: '5dd0d998-ec26-4fbd-9589-eca8aa9a9311',
      uploadIntentId: '126b455f-b9e7-49b9-aab6-4cb1ff971328',
      maxBytes: '80',
      iat: Math.floor(now.getTime() / 1000),
    })
    expect(payload.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(payload.exp).toBe(Math.floor(now.getTime() / 1000) + 300)
    expect(verifyStorageGrant(token, secret, now)).toMatchObject({
      purpose: 'upload',
      maxBytes: '80',
    })

    expect(() =>
      verifyStorageGrant(token, 'identity-test-secret-at-least-32-bytes', now),
    ).toThrow('invalid storage grant')

    const [headerPart, payloadPart, signaturePart] = token.split('.')
    const expectedSignature = createHmac('sha256', secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url')
    expect(signaturePart).toBe(expectedSignature)
  })

  test('caps expiry at the earlier intent deadline and 300 seconds', () => {
    const now = new Date('2026-07-11T08:00:00.000Z')
    const token = issueStorageGrant({
      purpose: 'upload',
      objectKey: '16a2d2b5-9cef-4e17-a0d5-c914cb137e08',
      uploadIntentId: 'd271411a-e19c-4161-8192-3bfadce25354',
      maxBytes: 1n,
      now,
      expiresAt: new Date(now.getTime() + 45_000),
      secret: 'storage-grant-test-secret-at-least-32-bytes',
    })

    expect(decodePart(token, 1).exp).toBe(Math.floor(now.getTime() / 1000) + 45)
  })

  test('rejects user-path purposes and malformed object identifiers at the boundary', () => {
    expect(() =>
      issueStorageGrant({
        purpose: 'upload',
        objectKey: '../user/file.txt',
        uploadIntentId: 'd271411a-e19c-4161-8192-3bfadce25354',
        maxBytes: 1n,
        now: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        secret: 'storage-grant-test-secret-at-least-32-bytes',
      }),
    ).toThrow('invalid storage grant input')
  })
})
