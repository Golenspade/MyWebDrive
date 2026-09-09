import { normalizeEmail } from './email.js'

export type ProductRole = 'user' | 'superuser' | 'admin'

export function emailAllowlist(value: string): ReadonlySet<string> {
  const emails = new Set<string>()
  for (const candidate of value.split(',')) {
    if (!candidate.trim()) continue
    try {
      emails.add(normalizeEmail(candidate))
    } catch {
      continue
    }
  }
  return emails
}

export function signupRole(
  email: string,
  adminEmails: ReadonlySet<string>,
  superuserEmails: ReadonlySet<string>,
): ProductRole {
  if (adminEmails.has(email)) return 'admin'
  if (superuserEmails.has(email)) return 'superuser'
  return 'user'
}
