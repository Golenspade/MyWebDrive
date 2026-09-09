import { describe, expect, test } from 'vitest'

import { emailAllowlist, signupRole } from '../roles.js'

describe('signupRole', () => {
  test('assigns admin before superuser when an email is on both lists', () => {
    const email = 'both@example.test'
    const admins = emailAllowlist('both@example.test, admin@example.test')
    const superusers = emailAllowlist('both@example.test, lead@example.test')
    expect(signupRole(email, admins, superusers)).toBe('admin')
  })

  test('assigns superuser from CORE_SUPERUSER_EMAILS', () => {
    expect(
      signupRole(
        'lead@example.test',
        emailAllowlist('admin@example.test'),
        emailAllowlist('lead@example.test'),
      ),
    ).toBe('superuser')
  })

  test('assigns user when the email is on neither list', () => {
    expect(
      signupRole(
        'member@example.test',
        emailAllowlist('admin@example.test'),
        emailAllowlist('lead@example.test'),
      ),
    ).toBe('user')
  })

  test('ignores blank and invalid allowlist entries', () => {
    const admins = emailAllowlist(' ,not-an-email, ADMIN@Example.TEST ')
    expect(admins.has('admin@example.test')).toBe(true)
    expect(admins.size).toBe(1)
  })
})
