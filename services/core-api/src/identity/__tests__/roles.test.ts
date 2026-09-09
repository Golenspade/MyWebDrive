import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

import { emailAllowlist, signupRole } from '../roles.js'

function migratedSql() {
  const root = join(import.meta.dirname, '../../../prisma/migrations')
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(root, name, 'migration.sql'), 'utf8'))
    .join('\n')
}

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

  test('postgres role check persists superuser after migrations', () => {
    const checks = [...migratedSql().matchAll(/ADD CONSTRAINT "User_role_check" CHECK \("role" IN \(([^)]+)\)\)/g)]
    expect(checks.length).toBeGreaterThan(0)
    const last = checks.at(-1)?.[1] ?? ''
    expect(last).toContain("'user'")
    expect(last).toContain("'superuser'")
    expect(last).toContain("'admin'")
  })
})
