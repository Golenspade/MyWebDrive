export function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the browser gate`)
  return value
}

export function retryScopedEmail(email: string, retry: number) {
  if (retry === 0) return email
  const separator = email.lastIndexOf('@')
  if (separator <= 0) throw new Error('browser gate email must contain a local part and domain')
  return `${email.slice(0, separator)}-retry${retry}${email.slice(separator)}`
}
