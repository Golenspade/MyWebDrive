import { createHash } from 'node:crypto'

import { describe, expect, test, vi } from 'vitest'

import { createEmailSender } from '../email-sender.js'
import {
  createOtpDigest,
  generateOtpCode,
  normalizeEmail,
  otpDigestsEqual,
} from '../otp.js'

describe('OTP primitives', () => {
  test('normalizes surrounding whitespace and email case', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })

  test.each([undefined, null, '', 'not-an-email', 'a@', '@example.com', 'a b@example.com'])(
    'rejects invalid email input (%s)',
    (value) => {
      expect(() => normalizeEmail(value)).toThrow('invalid email')
    },
  )

  test('binds the digest to the challenge, email, code and pepper', () => {
    const digest = createOtpDigest('pepper', 'challenge-a', 'user@example.test', '012345')

    expect(digest).not.toEqual(
      createOtpDigest('pepper', 'challenge-b', 'user@example.test', '012345'),
    )
    expect(digest).not.toEqual(
      createOtpDigest('pepper', 'challenge-a', 'other@example.test', '012345'),
    )
    expect(digest).not.toEqual(
      createOtpDigest('pepper', 'challenge-a', 'user@example.test', '654321'),
    )
  })

  test('compares fixed-length digests without accepting malformed values', () => {
    const digest = createHash('sha256').update('same').digest()
    const different = createHash('sha256').update('different').digest()

    expect(otpDigestsEqual(digest, Buffer.from(digest))).toBe(true)
    expect(otpDigestsEqual(digest, different)).toBe(false)
    expect(otpDigestsEqual(digest, Buffer.alloc(3))).toBe(false)
  })

  test('generates exactly six numeric digits and rejection-samples biased values', () => {
    const samples = [Buffer.from([0xff, 0xff, 0xff]), Buffer.from([0x00, 0x00, 0x2a])]
    const code = generateOtpCode(() => samples.shift() ?? Buffer.alloc(3))

    expect(code).toBe('000042')
    expect(samples).toHaveLength(0)
  })
})

describe('email OTP provider', () => {
  test('posts the exact provider contract and accepts any 2xx response', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    const sender = createEmailSender({
      providerUrl: 'https://mail.example.test/',
      token: 'provider-token',
      fetchImpl,
    })
    const input = {
      to: 'recipient@example.test',
      code: '123456',
      ttlSeconds: 600,
      purpose: 'login',
    } as const

    await sender.sendOtp(input)

    expect(fetchImpl).toHaveBeenCalledWith('https://mail.example.test/v1/messages/otp', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer provider-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
  })

  test('maps provider transport and non-2xx failures to a generic error', async () => {
    const unavailable = createEmailSender({
      providerUrl: 'https://mail.example.test',
      token: 'provider-token',
      fetchImpl: vi.fn(async () => new Response('sensitive provider body', { status: 500 })),
    })

    await expect(
      unavailable.sendOtp({
        to: 'recipient@example.test',
        code: '123456',
        ttlSeconds: 600,
        purpose: 'login',
      }),
    ).rejects.toThrow('email provider unavailable')
  })
})
