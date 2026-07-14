import { lstat, readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const sensitiveTextPatterns = [
  { pattern: /\bAuthorization\s*:\s*Bearer\s+\S+/gi },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi },
  { pattern: /\bCookie\s*:\s*[^\r\n]+/gi },
  { pattern: /\b(?:mwd_refresh|mwd_access)=[^;\s]+/gi },
  {
    pattern: /(["']?(?:accessToken|refreshToken|mailboxToken|uploadGrant|downloadGrant|objectKey|challengeId|otp|CORE_SESSION_SECRET|OTP_PEPPER|STORAGE_GRANT_SECRET|CORE_CALLBACK_SECRET|EMAIL_PROVIDER_TOKEN|FAKE_EMAIL_TEST_TOKEN|E2E_MAILBOX_TOKEN|CORE_DATABASE_URL|REDIS_URL|POSTGRES_PASSWORD|REDIS_PASSWORD|MINIO_SECRET_KEY|MINIO_ROOT_PASSWORD)["']?\s*[:=]\s*)["']?(?!<redacted>)[^"'\s,}]+["']?/gi,
    preservePrefix: true,
  },
  {
    pattern: /(["']?code["']?\s*[:=]\s*)["']?(?!<redacted>)\d{6}["']?/gi,
    preservePrefix: true,
  },
  {
    pattern: /(\bX-Test-Mailbox-Token\s*:\s*)(?!<redacted>)\S+/gi,
    preservePrefix: true,
  },
  {
    pattern: /(\/api\/v1\/shares\/)(?!<redacted>)[^\/\s"'?#<>]+(?=\/download-ticket(?:[?#\s"'<>]|$))/gi,
    preservePrefix: true,
  },
  {
    pattern: /(\/api\/v1\/storage\/objects\/)(?!<redacted>)[^\/\s"'?#<>]+/gi,
    preservePrefix: true,
  },
  { pattern: /\b(?:postgres(?:ql)?|rediss?):\/\/[^\s"'<>]*@[^\s"'<>]*/gi },
  { pattern: /\bsmoke-(?:postgres|redis|minio)(?:-root)?-[A-Za-z0-9._:-]+\b/gi },
  { pattern: /\bsmoke-(?:mailbox|email-token)-[A-Za-z0-9._:-]+\b/gi },
  { pattern: /\bsmoke-email-token\b/gi },
  { pattern: /\bcontract-[A-Za-z0-9._-]*(?:secret|token|password|pepper)[A-Za-z0-9._-]*\b/gi },
]

const allowedComposeFiles = new Set([
  'compose/images.txt',
  'compose/logs.txt',
  'compose/ps.txt',
  'compose/services.txt',
])
const MAX_TEXT_ARTIFACT_BYTES = 4 * 1024 * 1024
const MAX_DECODED_BYTES = 256 * 1024
const MAX_DECODE_DEPTH = 3
const encodedCandidatePattern = /(?<![A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{16,}={0,2})(?![A-Za-z0-9+/_=-])/g
const sensitiveJsonKeys = new Set([
  'accesstoken',
  'refreshtoken',
  'mailboxtoken',
  'uploadgrant',
  'downloadgrant',
  'objectkey',
  'challengeid',
  'otp',
  'code',
  'core_session_secret',
  'otp_pepper',
  'storage_grant_secret',
  'core_callback_secret',
  'email_provider_token',
  'fake_email_test_token',
  'e2e_mailbox_token',
  'core_database_url',
  'redis_url',
  'postgres_password',
  'redis_password',
  'minio_secret_key',
  'minio_root_password',
])

function decodeCandidate(candidate) {
  if (candidate.length > MAX_DECODED_BYTES * 2) return null
  const normalized = candidate.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = normalized.length % 4
  if (remainder === 1) return null
  const padded = `${normalized}${remainder === 0 ? '' : '='.repeat(4 - remainder)}`
  const bytes = Buffer.from(padded, 'base64')
  if (bytes.length === 0 || bytes.length > MAX_DECODED_BYTES) return null
  const decoded = bytes.toString('utf8')
  if (decoded.includes('\uFFFD')) return null
  return decoded
}

function containsEncodedSensitiveText(input, depth = 0) {
  if (depth >= MAX_DECODE_DEPTH) return false
  encodedCandidatePattern.lastIndex = 0
  for (const match of input.matchAll(encodedCandidatePattern)) {
    const decoded = decodeCandidate(match[1])
    if (!decoded) continue
    if (containsSensitiveText(decoded) || containsEncodedSensitiveText(decoded, depth + 1)) return true
  }
  return false
}

function redactEncodedSensitiveText(input) {
  encodedCandidatePattern.lastIndex = 0
  return input.replace(encodedCandidatePattern, (candidate) => {
    const decoded = decodeCandidate(candidate)
    if (!decoded) return candidate
    return containsSensitiveText(decoded) || containsEncodedSensitiveText(decoded, 1)
      ? '<redacted-encoded>'
      : candidate
  })
}

export function redactSensitiveText(input) {
  let output = String(input)
  for (const { pattern, preservePrefix } of sensitiveTextPatterns) {
    output = output.replace(pattern, (...args) => preservePrefix ? `${args[1]}<redacted>` : '<redacted>')
  }
  output = output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => (
    email.toLowerCase().endsWith('@example.test') ? email : '<redacted-email>'
  ))
  return redactEncodedSensitiveText(output)
}

function redactJsonValue(value, key = '') {
  if (sensitiveJsonKeys.has(key.toLowerCase())) return '<redacted>'
  if (typeof value === 'string') return redactSensitiveText(value)
  if (Array.isArray(value)) return value.map((entry) => redactJsonValue(entry))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => (
      [entryKey, redactJsonValue(entryValue, entryKey)]
    )))
  }
  return value
}

export function redactPlaywrightReportJson(input) {
  let parsed
  try {
    parsed = JSON.parse(String(input))
  } catch {
    throw new Error('Playwright report is not valid JSON')
  }
  return `${JSON.stringify(redactJsonValue(parsed))}\n`
}

function isAllowedPath(path) {
  if (allowedComposeFiles.has(path)) return true
  if (path === 'playwright-report/results.json') return true
  if (path.startsWith('test-results/')) return extname(path) === '.png'
  return false
}

function containsSensitiveText(input) {
  if (/[A-Z0-9._%+-]+@(?!example\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}/i.test(input)) return true
  return sensitiveTextPatterns.some(({ pattern }) => {
    pattern.lastIndex = 0
    return pattern.test(input)
  })
}

export async function assertSafeArtifactTree(rootPath) {
  const root = resolve(rootPath)
  const rootInfo = await lstat(root)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('artifact root must be a real directory')

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name)
      if (relative(root, absolute).startsWith(`..${sep}`)) throw new Error('artifact path escaped its root')
      const path = relative(root, absolute).split(sep).join('/')
      if (entry.isSymbolicLink()) throw new Error(`artifact symlink is forbidden: ${path}`)
      if (entry.isDirectory()) {
        await visit(absolute)
        continue
      }
      if (!entry.isFile() || !isAllowedPath(path)) throw new Error(`artifact path is not allowlisted: ${path}`)
      if (extname(path) === '.png') {
        const bytes = await readFile(absolute)
        if (bytes.length < 4 || !bytes.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71]))) {
          throw new Error(`artifact PNG is invalid: ${path}`)
        }
        continue
      }
      const bytes = await readFile(absolute)
      if (bytes.length > MAX_TEXT_ARTIFACT_BYTES) throw new Error(`artifact textual file is too large: ${path}`)
      const text = bytes.toString('utf8')
      if (containsSensitiveText(text)) throw new Error(`artifact contains sensitive text: ${path}`)
      if (containsEncodedSensitiveText(text)) throw new Error(`artifact contains encoded sensitive text: ${path}`)
    }
  }

  await visit(root)
}

async function main() {
  const [command, path] = process.argv.slice(2)
  if (command === 'redact') {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    process.stdout.write(redactSensitiveText(input))
    return
  }
  if (command === 'redact-json') {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    process.stdout.write(redactPlaywrightReportJson(input))
    return
  }
  if (command === 'verify' && path) {
    await assertSafeArtifactTree(path)
    process.stdout.write('smoke artifacts: safe\n')
    return
  }
  throw new Error('usage: verify-smoke-artifacts.mjs redact | redact-json | verify <directory>')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
