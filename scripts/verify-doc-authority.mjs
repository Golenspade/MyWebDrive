import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const scriptRoot = path.resolve(import.meta.dirname, '..')

const routeGroups = [
  {
    source: 'services/core-api/src/identity/router.ts',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1/auth',
    mountFactory: 'createIdentityRouter',
    routes: [
      ['post', '/email/request'],
      ['post', '/email/verify'],
      ['post', '/refresh'],
      ['post', '/logout'],
      ['get', '/me'],
    ],
  },
  {
    source: 'services/core-api/src/files/router.ts',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createFilesRouter',
    routes: [
      ['get', '/files'],
      ['get', '/files/:fileId/versions'],
      ['get', '/admin/users/:userId/files'],
    ],
  },
  {
    source: 'services/core-api/src/uploads/router.ts',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createUploadRouter',
    routes: [
      ['post', '/files/:fileId/upload-intents'],
      ['post', '/upload-intents'],
      ['post', '/upload-intents/:id/cancel'],
      ['get', '/quota'],
      ['patch', '/admin/users/:userId/quota'],
    ],
  },
  {
    source: 'services/core-api/src/sharing/router.ts',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createSharingRouter',
    routes: [
      ['post', '/files/:fileId/shares'],
      ['get', '/files/:fileId/shares'],
      ['post', '/shares/:shareId/revoke'],
      ['post', '/files/:fileId/download-ticket'],
      ['post', '/shares/:token/download-ticket'],
      ['put', '/files/:fileId/publication'],
      ['get', '/publications'],
      ['post', '/publications/:slug/download-ticket'],
    ],
  },
  {
    source: 'services/core-api/src/analytics/router.ts',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createAnalyticsRouter',
    routes: [['get', '/admin/dashboard/business']],
  },
  {
    source: 'services/core-api/src/system-health/router.ts',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createSystemHealthRouter',
    routes: [['get', '/admin/dashboard/system']],
  },
  {
    source: 'services/storage/src/api.ts',
    mountSource: 'services/storage/src/index.ts',
    mountPrefix: '',
    mountMarker: /router:\s*createStorageApi\s*\(/,
    routes: [
      ['put', '/api/v1/storage/uploads/:objectKey/parts/:partNumber'],
      ['post', '/api/v1/storage/uploads/:objectKey/complete'],
      ['get', '/api/v1/storage/objects/:objectKey'],
    ],
  },
]

const activeDocs = [
  'AGENTS.md',
  'CLAUDE.md',
  'CONTEXT.md',
  'CONTRIBUTING.md',
  'README.md',
  'SECURITY.md',
  'docs/context/dashboard-analytics.md',
  'docs/manage-services.md',
  'infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md',
  'docs/runbooks/core-cutover-and-rollback.md',
]

const authorityPaths = [
  'manage-services.sh',
  'infrastructure/alicloud/docker-compose.core.yml',
  'infrastructure/alicloud/deploy.sh',
  'infrastructure/alicloud/rollback.sh',
  'scripts/smoke-core-e2e.sh',
]

const requiredOperationalExclusions = [
  '/api/v1/internal/*',
  '/metrics',
  '/live',
  '/ready',
  '/version',
]

const exactRedoclyIgnore = `# Logout is intentionally idempotent: it clears the refresh cookie and returns 204 even when no session exists.
docs/openapi.yaml:
  operation-4xx-response:
    - '#/paths/~1api~1v1~1auth~1logout/post/responses'
`

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'])

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function openApiPath(prefix, routerPath) {
  return `${prefix}${routerPath}`.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '{$1}')
}

function routeKey(method, apiPath) {
  return `${method.toUpperCase()} ${apiPath}`
}

function parseRootArgument(argv) {
  if (argv.length === 0) return scriptRoot
  if (argv.length === 2 && argv[0] === '--root' && argv[1]) return path.resolve(argv[1])
  throw new Error('usage: node scripts/verify-doc-authority.mjs [--root <repository>]')
}

async function bundleOpenApi(root, failures) {
  const openApiFile = path.join(root, 'docs/openapi.yaml')
  const temporary = await mkdtemp(path.join(tmpdir(), 'mywebdrive-openapi-'))
  const output = path.join(temporary, 'openapi.json')
  const redocly = path.join(scriptRoot, 'node_modules/.bin/redocly')
  try {
    await access(redocly, fsConstants.X_OK)
    const result = spawnSync(
      redocly,
      ['bundle', openApiFile, '--ext', 'json', '--output', output],
      { encoding: 'utf8' },
    )
    if (result.error || result.status !== 0) {
      const detail = (result.stderr || result.stdout || result.error?.message || 'unknown parser error')
        .trim()
        .split('\n')[0]
      failures.push(`could not parse docs/openapi.yaml: ${detail}`)
      return null
    }
    try {
      return JSON.parse(await readFile(output, 'utf8'))
    } catch (error) {
      failures.push(`could not parse docs/openapi.yaml: ${error.message}`)
      return null
    }
  } catch (error) {
    failures.push(`could not parse docs/openapi.yaml: ${error.message}`)
    return null
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function readAuthorityFile(root, relative, failures) {
  try {
    return await readFile(path.join(root, relative), 'utf8')
  } catch (error) {
    failures.push(`could not read ${relative}: ${error.message}`)
    return null
  }
}

function verifySourceRoutes(root, failures, sources) {
  for (const group of routeGroups) {
    const mountSource = sources.get(group.mountSource)
    if (mountSource !== null) {
      const mountPattern = group.mountMarker ?? new RegExp(
        `app\\.use\\(\\s*['\"]${escapeRegex(group.mountPrefix)}['\"]\\s*,\\s*${escapeRegex(group.mountFactory)}\\s*\\(`,
      )
      if (!mountPattern.test(mountSource)) {
        failures.push(`source authority is missing mount ${group.mountPrefix || '/'} -> ${group.mountFactory ?? 'storage router'}`)
      }
    }

    const source = sources.get(group.source)
    if (source === null) continue
    for (const [method, routerPath] of group.routes) {
      const marker = new RegExp(
        `router\\s*\\.\\s*${method}\\s*\\(\\s*['\"]${escapeRegex(routerPath)}['\"]`,
      )
      const apiPath = openApiPath(group.mountPrefix, routerPath)
      if (!marker.test(source)) {
        failures.push(`source authority is missing ${routeKey(method, apiPath)}`)
      }
    }
  }
}

function publicManifest() {
  return new Map(
    routeGroups.flatMap((group) =>
      group.routes.map(([method, routerPath]) => {
        const apiPath = openApiPath(group.mountPrefix, routerPath)
        return [routeKey(method, apiPath), { method, apiPath }]
      }),
    ),
  )
}

function verifyOpenApi(document, failures) {
  if (!document) return
  if (!document.paths || typeof document.paths !== 'object' || Array.isArray(document.paths)) {
    failures.push('docs/openapi.yaml does not define a paths object')
    return
  }

  const exclusions = document['x-private-operational-paths']
  if (!Array.isArray(exclusions)) {
    failures.push('OpenAPI does not declare x-private-operational-paths')
  } else {
    for (const expected of requiredOperationalExclusions) {
      if (!exclusions.includes(expected)) {
        failures.push(`OpenAPI operational exclusions are missing ${expected}`)
      }
    }
  }

  const documented = new Set()
  for (const [apiPath, pathItem] of Object.entries(document.paths)) {
    if (
      apiPath === '/metrics' ||
      apiPath === '/live' ||
      apiPath === '/ready' ||
      apiPath === '/version' ||
      apiPath === '/api/v1/internal' ||
      apiPath.startsWith('/api/v1/internal/')
    ) {
      failures.push(`OpenAPI exposes private or operational path ${apiPath}`)
    }
    if (!pathItem || typeof pathItem !== 'object' || Array.isArray(pathItem)) continue
    for (const method of Object.keys(pathItem)) {
      if (httpMethods.has(method)) documented.add(routeKey(method, apiPath))
    }
  }

  const expected = publicManifest()
  for (const [key] of expected) {
    if (!documented.has(key)) failures.push(`OpenAPI is missing ${key}`)
  }
  for (const key of documented) {
    if (!expected.has(key)) failures.push(`OpenAPI documents a non-authoritative public operation: ${key}`)
  }
}

function verifyActiveDocs(failures, docs) {
  const forbidden = [
    /\/api\/v1\/auth\/(?:register|login)\b/i,
    /\bpassword[- ]login\b/i,
    /\bapps\/web\b/i,
    /\bservices\/(?:auth|user|metadata|sharing|api-gateway-node)\b/i,
    /\b(?:localhost|127\.0\.0\.1):9080\b/i,
    /\.\/manage-services\.sh\s+(?:start-backend|start-frontend|start-frontend-prod|restart)\b/i,
    /docker-compose\.(?:production|node|images|alicloud)\.yml/i,
  ]
  for (const [relative, source] of docs) {
    if (source === null) continue
    if (forbidden.some((pattern) => pattern.test(source))) {
      failures.push(`${relative} contains a forbidden retired API claim`)
    }
  }

  const combined = [...docs.values()].filter((value) => value !== null).join('\n')
  for (const authorityPath of authorityPaths) {
    if (!combined.includes(authorityPath)) {
      failures.push(`active docs do not reference current authority path: ${authorityPath}`)
    }
  }
}

async function verifyAuthorityPaths(root, failures) {
  for (const relative of authorityPaths) {
    try {
      await access(path.join(root, relative), fsConstants.F_OK)
    } catch {
      failures.push(`referenced authority path is missing: ${relative}`)
    }
  }
}

async function main() {
  let root
  try {
    root = parseRootArgument(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
    return
  }

  const failures = []
  const sourceFiles = new Set(routeGroups.flatMap((group) => [group.source, group.mountSource]))
  const sources = new Map()
  for (const relative of sourceFiles) {
    sources.set(relative, await readAuthorityFile(root, relative, failures))
  }
  const docs = new Map()
  for (const relative of activeDocs) {
    docs.set(relative, await readAuthorityFile(root, relative, failures))
  }
  const redoclyIgnore = await readAuthorityFile(
    root,
    '.redocly.lint-ignore.yaml',
    failures,
  )

  verifySourceRoutes(root, failures, sources)
  verifyOpenApi(await bundleOpenApi(root, failures), failures)
  verifyActiveDocs(failures, docs)
  if (redoclyIgnore !== exactRedoclyIgnore) {
    failures.push('Redocly lint exception must be scoped to idempotent logout and retain its reason')
  }
  await verifyAuthorityPaths(root, failures)

  if (failures.length > 0) {
    for (const failure of failures) {
      process.stderr.write(`documentation authority failed: ${failure}\n`)
    }
    process.stderr.write(`documentation authority failures: ${failures.length}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write('documentation authority: ok\n')
}

await main()
