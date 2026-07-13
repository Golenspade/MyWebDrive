import { lstat, readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const sensitiveTextPatterns = [
  { pattern: /\bAuthorization\s*:\s*Bearer\s+\S+/gi },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi },
  { pattern: /\bCookie\s*:\s*[^\r\n]+/gi },
  { pattern: /\b(?:mwd_refresh|mwd_access)=[^;\s]+/gi },
  {
    pattern: /(["']?(?:accessToken|refreshToken|mailboxToken|uploadGrant|downloadGrant|objectKey|challengeId|otp|CORE_SESSION_SECRET|OTP_PEPPER|STORAGE_GRANT_SECRET|CORE_CALLBACK_SECRET|EMAIL_PROVIDER_TOKEN|FAKE_EMAIL_TEST_TOKEN|E2E_MAILBOX_TOKEN|POSTGRES_PASSWORD|REDIS_PASSWORD|MINIO_ROOT_PASSWORD)["']?\s*[:=]\s*)["']?(?!<redacted>)[^"'\s,}]+["']?/gi,
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
  { pattern: /\bsmoke-(?:mailbox|email-token)-[A-Za-z0-9._:-]+\b/gi },
  { pattern: /\bcontract-[A-Za-z0-9._-]*(?:secret|token|password|pepper)[A-Za-z0-9._-]*\b/gi },
]

const allowedComposeFiles = new Set([
  'compose/images.txt',
  'compose/logs.txt',
  'compose/ps.txt',
  'compose/services.txt',
])
const allowedReportExtensions = new Set(['.css', '.html', '.js', '.json', '.png', '.txt'])

export function redactSensitiveText(input) {
  let output = String(input)
  for (const { pattern, preservePrefix } of sensitiveTextPatterns) {
    output = output.replace(pattern, (...args) => preservePrefix ? `${args[1]}<redacted>` : '<redacted>')
  }
  output = output.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (email) => (
    email.toLowerCase().endsWith('@example.test') ? email : '<redacted-email>'
  ))
  return output
}

function isAllowedPath(path) {
  if (allowedComposeFiles.has(path)) return true
  if (path.startsWith('playwright-report/')) return allowedReportExtensions.has(extname(path))
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
      const text = await readFile(absolute, 'utf8')
      if (containsSensitiveText(text)) throw new Error(`artifact contains sensitive text: ${path}`)
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
  if (command === 'verify' && path) {
    await assertSafeArtifactTree(path)
    process.stdout.write('smoke artifacts: safe\n')
    return
  }
  throw new Error('usage: verify-smoke-artifacts.mjs redact | verify <directory>')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
