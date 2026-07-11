export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid email')

  const email = value.trim().toLowerCase()
  if (
    email.length === 0 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('invalid email')
  }
  return email
}
