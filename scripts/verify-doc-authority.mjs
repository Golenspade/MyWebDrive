import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ts from 'typescript'

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
    routes: [
      ['put', '/api/v1/storage/uploads/:objectKey/parts/:partNumber'],
      ['post', '/api/v1/storage/uploads/:objectKey/complete'],
      ['get', '/api/v1/storage/objects/:objectKey'],
    ],
  },
]

const activeDocFiles = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'CODE_OF_CONDUCT.md',
  'CONTEXT.md',
  'CONTRIBUTING.md',
  'README.md',
  'SECURITY.md',
  'docs/manage-services.md',
  'frontend/cruip-landing/README.md',
  'infrastructure/alicloud/ALIYUN_DEPLOY_GUIDE.md',
])

const activeDocPrefixes = ['docs/context/', 'docs/runbooks/']

const historicalDocFiles = new Set([
  'CHANGELOG.md',
  'docs/CHANGELOG.md',
  'frontend/ARCHIVED.md',
  'frontend/cruip-landing/CHANGELOG.md',
])

const historicalDocPrefixes = [
  'archive/',
  'docs/_archive/',
  'docs/reports/',
  'docs/superpowers/plans/',
  'docs/superpowers/specs/',
]

const classifiedNonPublicRoutes = [
  {
    source: 'services/core-api/src/app.ts',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/metrics'], ['get', '/live'], ['get', '/ready'], ['get', '/version']],
  },
  {
    source: 'services/core-api/src/uploads/router.ts',
    receiver: 'router',
    mountPrefix: '/api/v1',
    visibility: 'internal',
    routes: [['post', '/internal/upload-intents/:id/complete']],
  },
  {
    source: 'services/core-api/src/analytics/download-attempt.ts',
    receiver: 'router',
    mountPrefix: '/api/v1',
    visibility: 'internal',
    routes: [['post', '/internal/download-attempts/:id/:phase']],
  },
  {
    source: 'services/core-api/src/analytics/runtime.ts',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/metrics'], ['get', '/live'], ['get', '/ready']],
  },
  {
    source: 'services/storage/src/api.ts',
    receiver: 'router',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/live'], ['get', '/ready']],
  },
  {
    source: 'services/storage/src/server.ts',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/metrics'], ['get', '/live'], ['get', '/ready']],
  },
]

const classifiedCoreMounts = [
  ...routeGroups
    .filter((group) => group.mountSource === 'services/core-api/src/app.ts')
    .map((group) => [group.mountPrefix, group.mountFactory]),
  ['/api/v1', 'createDownloadAttemptCallbackRouter'],
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

function openApiPath(prefix, routerPath) {
  return `${prefix}${routerPath}`.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '{$1}')
}

function isStringLiteral(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function parseTypeScript(relative, source, failures) {
  const parsed = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  for (const diagnostic of parsed.parseDiagnostics) {
    failures.push(`could not parse ${relative}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`)
  }
  return parsed
}

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function callName(expression) {
  return ts.isIdentifier(expression) ? expression.text : null
}

function enumerateHttpRoutes(parsed, receiver) {
  const routes = []
  walk(parsed, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (!ts.isIdentifier(node.expression.expression) || node.expression.expression.text !== receiver) return
    const method = node.expression.name.text.toLowerCase()
    if (!httpMethods.has(method) || !isStringLiteral(node.arguments[0])) return
    routes.push([method, node.arguments[0].text, node])
  })
  return routes
}

function enumerateCoreMounts(parsed) {
  const mounts = []
  walk(parsed, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (!ts.isIdentifier(node.expression.expression) || node.expression.expression.text !== 'app') return
    if (node.expression.name.text !== 'use' || !isStringLiteral(node.arguments[0])) return
    const factoryCall = node.arguments[1]
    if (!ts.isCallExpression(factoryCall)) return
    const factory = callName(factoryCall.expression)
    if (factory) mounts.push([node.arguments[0].text, factory])
  })
  return mounts
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

function verifySourceRoutes(failures, sources) {
  const descriptors = [
    ...routeGroups.map((group) => ({
      source: group.source,
      receiver: 'router',
      mountPrefix: group.mountPrefix,
      visibility: 'public',
      routes: group.routes,
    })),
    ...classifiedNonPublicRoutes,
  ]
  const bySource = new Map()
  for (const descriptor of descriptors) {
    const current = bySource.get(descriptor.source) ?? []
    current.push(descriptor)
    bySource.set(descriptor.source, current)
  }

  for (const [relative, sourceDescriptors] of bySource) {
    const source = sources.get(relative)
    if (source === null || source === undefined) continue
    const parsed = parseTypeScript(relative, source, failures)
    const receiver = sourceDescriptors[0].receiver
    const actual = new Map(
      enumerateHttpRoutes(parsed, receiver).map(([method, routerPath]) => [
        `${method.toUpperCase()} ${routerPath}`,
        [method, routerPath],
      ]),
    )
    const expected = new Map()
    for (const descriptor of sourceDescriptors) {
      for (const [method, routerPath] of descriptor.routes) {
        expected.set(`${method.toUpperCase()} ${routerPath}`, { ...descriptor, method, routerPath })
      }
    }
    for (const [localKey, descriptor] of expected) {
      if (actual.has(localKey)) continue
      const apiPath = openApiPath(descriptor.mountPrefix, descriptor.routerPath)
      failures.push(`source authority is missing ${routeKey(descriptor.method, apiPath)}`)
    }
    for (const [localKey, [method, routerPath]] of actual) {
      if (expected.has(localKey)) continue
      const apiPath = openApiPath(sourceDescriptors[0].mountPrefix, routerPath)
      failures.push(`unclassified source route ${routeKey(method, apiPath)} in ${relative}`)
    }
  }

  const appSource = sources.get('services/core-api/src/app.ts')
  if (appSource !== null && appSource !== undefined) {
    const actualMounts = new Set(
      enumerateCoreMounts(parseTypeScript('services/core-api/src/app.ts', appSource, failures))
        .map(([prefix, factory]) => `${prefix} -> ${factory}`),
    )
    const expectedMounts = new Set(
      classifiedCoreMounts.map(([prefix, factory]) => `${prefix} -> ${factory}`),
    )
    for (const mount of expectedMounts) {
      if (!actualMounts.has(mount)) failures.push(`source authority is missing mount ${mount}`)
    }
    for (const mount of actualMounts) {
      if (!expectedMounts.has(mount)) failures.push(`unclassified source mount ${mount}`)
    }
  }

  verifyStorageBinding(sources, failures)
}

function verifyStorageBinding(sources, failures) {
  const indexSource = sources.get('services/storage/src/index.ts')
  if (indexSource !== null && indexSource !== undefined) {
    const parsed = parseTypeScript('services/storage/src/index.ts', indexSource, failures)
    let bindingFound = false
    walk(parsed, (node) => {
      if (!ts.isCallExpression(node) || callName(node.expression) !== 'createStorageApiApp') return
      const object = node.arguments[0]
      if (!ts.isObjectLiteralExpression(object)) return
      const router = object.properties.find(
        (property) => ts.isPropertyAssignment(property) && property.name.getText(parsed) === 'router',
      )
      if (
        router &&
        ts.isPropertyAssignment(router) &&
        ts.isCallExpression(router.initializer) &&
        callName(router.initializer.expression) === 'createStorageApi'
      ) {
        bindingFound = true
      }
    })
    if (!bindingFound) failures.push('source authority is missing mount / -> storage router')
  }

  const serverSource = sources.get('services/storage/src/server.ts')
  if (serverSource !== null && serverSource !== undefined) {
    const parsed = parseTypeScript('services/storage/src/server.ts', serverSource, failures)
    let routerUseFound = false
    walk(parsed, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
      if (node.expression.getText(parsed) !== 'app.use') return
      if (node.arguments[0]?.getText(parsed) === 'input.router') routerUseFound = true
    })
    if (!routerUseFound) failures.push('source authority is missing app.use(input.router) storage binding')
  }
}

function verifyStorageCompletionParser(sources, failures) {
  const apiSource = sources.get('services/storage/src/api.ts')
  if (apiSource === null || apiSource === undefined) return
  const parsed = parseTypeScript('services/storage/src/api.ts', apiSource, failures)
  let parserContractFound = false
  walk(parsed, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (node.expression.getText(parsed) !== 'router.post') return
    if (!isStringLiteral(node.arguments[0])) return
    if (node.arguments[0].text !== '/api/v1/storage/uploads/:objectKey/complete') return
    const parser = node.arguments[1]
    if (
      !ts.isCallExpression(parser) ||
      !ts.isPropertyAccessExpression(parser.expression) ||
      parser.expression.getText(parsed) !== 'express.json'
    ) return
    const options = parser.arguments[0]
    if (!ts.isObjectLiteralExpression(options)) return
    const properties = new Map(
      options.properties
        .filter(ts.isPropertyAssignment)
        .map((property) => [property.name.getText(parsed), property.initializer]),
    )
    const limit = properties.get('limit')
    const strict = properties.get('strict')
    if (isStringLiteral(limit) && limit.text === '1kb' && strict?.kind === ts.SyntaxKind.TrueKeyword) {
      parserContractFound = node.arguments.length >= 3
    }
  })
  if (!parserContractFound) {
    failures.push('storage completion source must retain route-scoped express.json 1kb strict parser')
  }

  const serverSource = sources.get('services/storage/src/server.ts')
  if (serverSource === null || serverSource === undefined) return
  const server = parseTypeScript('services/storage/src/server.ts', serverSource, failures)
  let routerUseEnd = -1
  const trailingErrorMiddleware = []
  walk(server, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
    if (node.expression.getText(server) !== 'app.use') return
    if (node.arguments[0]?.getText(server) === 'input.router') routerUseEnd = node.end
    const handler = node.arguments.at(-1)
    if (
      handler &&
      node.pos > routerUseEnd &&
      (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
      handler.parameters.length === 4
    ) {
      trailingErrorMiddleware.push(node)
    }
  })
  if (trailingErrorMiddleware.length > 0) {
    failures.push('storage completion parser errors no longer flow to the default Express final handler')
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

  verifyOpenApiSchemas(document, failures)
}

function verifyOpenApiSchemas(document, failures) {
  const completion = document.paths?.['/api/v1/storage/uploads/{objectKey}/complete']?.post
  const parserContent = completion?.responses?.['413']?.content
  const parserMedia = parserContent && typeof parserContent === 'object'
    ? Object.keys(parserContent)
    : []
  if (
    parserMedia.length !== 1 ||
    parserMedia[0] !== 'text/html' ||
    parserContent?.['text/html']?.schema?.type !== 'string'
  ) {
    failures.push('storage completion 413 must document text/html with a string schema')
  }

  const schemas = document.components?.schemas ?? {}
  if (schemas.PositiveByteString?.['x-maximum-decimal'] !== '9223372036854775807') {
    failures.push('PositiveByteString must declare signed 64-bit maximum 9223372036854775807')
  }

  const fileName = schemas.UploadFileName
  const expectedFileNamePattern = '^(?=\\S(?:[\\s\\S]*\\S)?$)[^/\\\\\\x00-\\x1F\\x7F]+$'
  if (
    fileName?.['x-trimmed'] !== true ||
    fileName?.['x-max-js-utf16-code-units'] !== 255 ||
    fileName?.pattern !== expectedFileNamePattern ||
    'maxLength' in (fileName ?? {})
  ) {
    failures.push('UploadFileName must require trimmed input and forbid slash, backslash, control, and DEL characters')
  }

  const mimeType = schemas.UploadMimeType
  const expectedMimePattern = '^(?=\\S(?:[\\s\\S]*\\S)?$)[^\\x00-\\x1F\\x7F]+$'
  if (
    mimeType?.['x-trimmed'] !== true ||
    mimeType?.['x-max-js-utf16-code-units'] !== 255 ||
    mimeType?.pattern !== expectedMimePattern ||
    'maxLength' in (mimeType ?? {})
  ) {
    failures.push('UploadMimeType must require trimmed input and forbid control and DEL characters')
  }

  const upload = schemas.NewFileUploadIntent
  const replacement = schemas.ReplacementUploadIntent
  if (
    upload?.properties?.fileName?.$ref !== '#/components/schemas/UploadFileName' ||
    upload?.properties?.mimeType?.$ref !== '#/components/schemas/UploadMimeType' ||
    replacement?.properties?.mimeType?.$ref !== '#/components/schemas/UploadMimeType' ||
    upload?.additionalProperties === false ||
    replacement?.additionalProperties === false
  ) {
    failures.push('upload request schemas do not match parseUploadIntent input handling')
  }

  const password = schemas.SharePassword
  if (
    password?.['x-max-utf8-bytes'] !== 1024 ||
    password?.minLength !== 1 ||
    'maxLength' in (password ?? {})
  ) {
    failures.push('SharePassword must declare a 1024-byte UTF-8 limit')
  }
  const sharePassword = schemas.CreateShare?.properties?.password?.$ref
  const ticketPassword = completionSchema(document, '/api/v1/shares/{token}/download-ticket')
    ?.properties?.password?.$ref
  if (
    sharePassword !== '#/components/schemas/SharePassword' ||
    ticketPassword !== '#/components/schemas/SharePassword' ||
    schemas.CreateShare?.additionalProperties === false ||
    completionSchema(document, '/api/v1/shares/{token}/download-ticket')?.additionalProperties === false
  ) {
    failures.push('share request schemas do not match permissive request-object parsing')
  }
}

function completionSchema(document, apiPath) {
  return document.paths?.[apiPath]?.post?.requestBody?.content?.['application/json']?.schema
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
    if (/2026-07-(?:13|26|27)\b/.test(source)) {
      failures.push(`${relative} contains a hard-coded retirement date`)
    }
  }

  const retirementAuthority = docs.get('docs/manage-services.md') ?? ''
  const eventRule = [
    'retirement clock has not started',
    'final production deploy, rollback, and redeploy acceptance',
    'recorded UTC completion timestamp',
    '14 consecutive dependency-free 24-hour periods',
  ]
  if (!eventRule.every((phrase) => retirementAuthority.includes(phrase))) {
    failures.push('docs/manage-services.md is missing the event-based retirement clock rule')
  }

  const combined = [...docs.values()].filter((value) => value !== null).join('\n')
  for (const authorityPath of authorityPaths) {
    if (!combined.includes(authorityPath)) {
      failures.push(`active docs do not reference current authority path: ${authorityPath}`)
    }
  }
}

function classifyMarkdown(relative) {
  if (activeDocFiles.has(relative) || activeDocPrefixes.some((prefix) => relative.startsWith(prefix))) {
    return 'active'
  }
  if (
    historicalDocFiles.has(relative) ||
    historicalDocPrefixes.some((prefix) => relative.startsWith(prefix))
  ) {
    return 'historical'
  }
  return null
}

function trackedMarkdown(root, failures) {
  const result = spawnSync('git', ['ls-files', '--', '*.md'], { cwd: root, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    failures.push(`could not enumerate tracked Markdown: ${(result.stderr || result.error?.message || 'git ls-files failed').trim()}`)
    return []
  }
  return result.stdout.split('\n').filter(Boolean)
}

async function readClassifiedDocs(root, failures) {
  const docs = new Map()
  for (const relative of trackedMarkdown(root, failures)) {
    const classification = classifyMarkdown(relative)
    if (classification === null) {
      failures.push(`tracked Markdown is not classified as active or historical: ${relative}`)
      continue
    }
    if (classification === 'active') {
      docs.set(relative, await readAuthorityFile(root, relative, failures))
    }
  }
  return docs
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
  const sourceFiles = new Set([
    ...routeGroups.flatMap((group) => [group.source, group.mountSource]),
    ...classifiedNonPublicRoutes.map((entry) => entry.source),
    'services/storage/src/server.ts',
  ])
  const sources = new Map()
  for (const relative of sourceFiles) {
    sources.set(relative, await readAuthorityFile(root, relative, failures))
  }
  const docs = await readClassifiedDocs(root, failures)
  const redoclyIgnore = await readAuthorityFile(
    root,
    '.redocly.lint-ignore.yaml',
    failures,
  )

  verifySourceRoutes(failures, sources)
  verifyStorageCompletionParser(sources, failures)
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
