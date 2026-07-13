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
    factory: 'createIdentityRouter',
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
    factory: 'createFilesRouter',
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
    factory: 'createUploadRouter',
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
    factory: 'createSharingRouter',
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
    factory: 'createAnalyticsRouter',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createAnalyticsRouter',
    routes: [['get', '/admin/dashboard/business']],
  },
  {
    source: 'services/core-api/src/system-health/router.ts',
    factory: 'createSystemHealthRouter',
    mountSource: 'services/core-api/src/app.ts',
    mountPrefix: '/api/v1',
    mountFactory: 'createSystemHealthRouter',
    routes: [['get', '/admin/dashboard/system']],
  },
  {
    source: 'services/storage/src/api.ts',
    factory: 'createStorageApi',
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
    factory: 'createCoreApp',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/metrics'], ['get', '/live'], ['get', '/ready'], ['get', '/version']],
  },
  {
    source: 'services/core-api/src/uploads/router.ts',
    factory: 'createUploadRouter',
    receiver: 'router',
    mountPrefix: '/api/v1',
    visibility: 'internal',
    routes: [['post', '/internal/upload-intents/:id/complete']],
  },
  {
    source: 'services/core-api/src/analytics/download-attempt.ts',
    factory: 'createDownloadAttemptCallbackRouter',
    receiver: 'router',
    mountPrefix: '/api/v1',
    visibility: 'internal',
    routes: [['post', '/internal/download-attempts/:id/:phase']],
  },
  {
    source: 'services/core-api/src/analytics/runtime.ts',
    factory: 'createAnalyticsWorkerHealthApp',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/metrics'], ['get', '/live'], ['get', '/ready']],
  },
  {
    source: 'services/storage/src/api.ts',
    factory: 'createStorageApi',
    receiver: 'router',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/live'], ['get', '/ready']],
  },
  {
    source: 'services/storage/src/server.ts',
    factory: 'baseApp',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/metrics']],
  },
  {
    source: 'services/storage/src/server.ts',
    factory: 'createStorageWorkerHealthApp',
    receiver: 'app',
    mountPrefix: '',
    visibility: 'operational',
    routes: [['get', '/live'], ['get', '/ready']],
  },
]

const classifiedCoreMounts = [
  ...routeGroups
    .filter((group) => group.mountSource === 'services/core-api/src/app.ts')
    .map((group) => [
      group.mountPrefix,
      group.mountFactory,
      sourceImportPath(group.mountSource, group.source),
    ]),
  [
    '/api/v1',
    'createDownloadAttemptCallbackRouter',
    './analytics/download-attempt.js',
  ],
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

function sourceImportPath(importer, imported) {
  const relative = path.posix.relative(path.posix.dirname(importer), imported)
    .replace(/\.ts$/, '.js')
  return relative.startsWith('.') ? relative : `./${relative}`
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

function findNamedFunction(parsed, name, failures) {
  const matches = parsed.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  )
  if (matches.length !== 1 || !matches[0].body) {
    failures.push(`source authority could not resolve designated factory ${name}`)
    return null
  }
  return matches[0]
}

function expressionCall(statement) {
  return ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
    ? statement.expression
    : null
}

function hasDirectReceiverBinding(factory, receiver) {
  for (const statement of factory.body.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === receiver) {
        const initializer = declaration.initializer
        if (!ts.isCallExpression(initializer)) continue
        if (receiver === 'router') {
          if (
            ts.isPropertyAccessExpression(initializer.expression) &&
            initializer.expression.getText(factory.getSourceFile()) === 'express.Router'
          ) return true
        } else if (callName(initializer.expression) === 'express') {
          return true
        }
      }
      if (receiver === 'app' && ts.isObjectBindingPattern(declaration.name)) {
        const bindsApp = declaration.name.elements.some(
          (element) => ts.isIdentifier(element.name) && element.name.text === 'app',
        )
        if (
          bindsApp &&
          ts.isCallExpression(declaration.initializer) &&
          callName(declaration.initializer.expression) === 'baseApp'
        ) return true
      }
    }
  }
  return false
}

function directRouteRegistrations(factory, receiver, failures) {
  if (!hasDirectReceiverBinding(factory, receiver)) {
    failures.push(`source authority has unsupported ${receiver} binding in ${factory.name.text}`)
    return { routes: [], accepted: new Set() }
  }
  const routes = []
  const accepted = new Set()
  for (const statement of factory.body.statements) {
    const call = expressionCall(statement)
    if (!call || !ts.isPropertyAccessExpression(call.expression)) continue
    if (!ts.isIdentifier(call.expression.expression) || call.expression.expression.text !== receiver) continue
    const method = call.expression.name.text.toLowerCase()
    if (!httpMethods.has(method)) continue
    if (!isStringLiteral(call.arguments[0])) continue
    routes.push([method, call.arguments[0].text, call])
    accepted.add(call)
  }
  return { routes, accepted }
}

function enclosingFunctionName(node) {
  let current = node.parent
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)) &&
      current.name
    ) return current.name.text
    current = current.parent
  }
  return null
}

function scanUnsupportedRouteForms(parsed, accepted, receiverNames, failures) {
  const receiverAliases = new Map()
  const methodAliases = new Map()
  walk(parsed, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return
    if (ts.isIdentifier(node.initializer) && receiverNames.has(node.initializer.text)) {
      receiverAliases.set(node.name.text, node.initializer.text)
    }
    if (
      ts.isPropertyAccessExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      receiverNames.has(node.initializer.expression.text) &&
      httpMethods.has(node.initializer.name.text.toLowerCase())
    ) {
      methodAliases.set(node.name.text, node.initializer.name.text.toLowerCase())
    }
  })

  walk(parsed, (node) => {
    if (!ts.isCallExpression(node)) return
    if (ts.isIdentifier(node.expression) && methodAliases.has(node.expression.text)) {
      failures.push(`unsupported indirect route method ${node.expression.text} in ${parsed.fileName}`)
      return
    }
    if (ts.isElementAccessExpression(node.expression)) {
      const target = node.expression.expression
      if (ts.isIdentifier(target) && (receiverNames.has(target.text) || receiverAliases.has(target.text))) {
        failures.push(`unsupported computed route registration in ${parsed.fileName}`)
      }
      return
    }
    if (!ts.isPropertyAccessExpression(node.expression)) return
    const property = node.expression.name.text.toLowerCase()
    const target = node.expression.expression
    if (
      property === 'route' &&
      ts.isIdentifier(target) &&
      (receiverNames.has(target.text) || receiverAliases.has(target.text))
    ) {
      const routePath = isStringLiteral(node.arguments[0]) ? node.arguments[0].text : '<dynamic>'
      failures.push(`unsupported chained route registration ${routePath} in ${parsed.fileName}`)
      return
    }
    if (!httpMethods.has(property) || accepted.has(node)) return

    if (ts.isIdentifier(target) && receiverAliases.has(target.text)) {
      failures.push(`unsupported aliased route receiver ${target.text} in ${parsed.fileName}`)
      return
    }
    const knownReceiver = ts.isIdentifier(target) && receiverNames.has(target.text)
    const literalPath = isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('/')
    if (knownReceiver && !isStringLiteral(node.arguments[0])) {
      failures.push(`unsupported dynamic route path in ${enclosingFunctionName(node) ?? parsed.fileName}`)
      return
    }
    if (knownReceiver || literalPath) {
      const routePath = isStringLiteral(node.arguments[0]) ? node.arguments[0].text : '<dynamic>'
      failures.push(`unsupported or dead route registration ${property.toUpperCase()} ${routePath} in ${parsed.fileName}`)
    }
  })
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
      factory: group.factory,
      receiver: 'router',
      mountPrefix: group.mountPrefix,
      visibility: 'public',
      routes: group.routes,
    })),
    ...classifiedNonPublicRoutes,
  ]
  const bySource = new Map()
  for (const descriptor of descriptors) {
    const factories = bySource.get(descriptor.source) ?? new Map()
    const current = factories.get(descriptor.factory) ?? []
    current.push(descriptor)
    factories.set(descriptor.factory, current)
    bySource.set(descriptor.source, factories)
  }

  for (const [relative, factoryDescriptors] of bySource) {
    const source = sources.get(relative)
    if (source === null || source === undefined) continue
    const parsed = parseTypeScript(relative, source, failures)
    if (!hasDefaultExpressBinding(parsed)) {
      failures.push(`source authority cannot resolve default Express binding in ${relative}`)
    }
    const accepted = new Set()
    const receiverNames = new Set()
    for (const [factoryName, sourceDescriptors] of factoryDescriptors) {
      const receiver = sourceDescriptors[0].receiver
      receiverNames.add(receiver)
      const factory = findNamedFunction(parsed, factoryName, failures)
      if (!factory) continue
      const inspected = directRouteRegistrations(factory, receiver, failures)
      for (const call of inspected.accepted) accepted.add(call)
      const actual = new Map()
      for (const [method, routerPath] of inspected.routes) {
        const key = `${method.toUpperCase()} ${routerPath}`
        if (actual.has(key)) {
          failures.push(`duplicate direct source route ${key} in ${factoryName}`)
        }
        actual.set(key, [method, routerPath])
      }
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
    scanUnsupportedRouteForms(parsed, accepted, receiverNames, failures)
  }

  const appSource = sources.get('services/core-api/src/app.ts')
  if (appSource !== null && appSource !== undefined) {
    verifyCoreMounts(
      parseTypeScript('services/core-api/src/app.ts', appSource, failures),
      failures,
    )
  }

  verifyStorageBinding(sources, failures)
}

function importedBindings(parsed) {
  const bindings = new Map()
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const named = statement.importClause?.namedBindings
    if (!named || !ts.isNamedImports(named)) continue
    for (const element of named.elements) {
      bindings.set(element.name.text, {
        importedName: element.propertyName?.text ?? element.name.text,
        moduleSpecifier: isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : null,
      })
    }
  }
  return bindings
}

function hasDefaultExpressBinding(parsed) {
  return parsed.statements.some((statement) => (
    ts.isImportDeclaration(statement) &&
    isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === 'express' &&
    statement.importClause?.name?.text === 'express'
  ))
}

function verifyCoreMounts(parsed, failures) {
  const factory = findNamedFunction(parsed, 'createCoreApp', failures)
  if (!factory) return
  if (!hasDirectReceiverBinding(factory, 'app')) {
    failures.push('source authority has unsupported app binding in createCoreApp')
    return
  }
  const recognizedFactories = new Set(classifiedCoreMounts.map(([, name]) => name))
  const imports = importedBindings(parsed)
  for (const [, name, moduleSpecifier] of classifiedCoreMounts) {
    const binding = imports.get(name)
    if (
      !binding ||
      binding.importedName !== name ||
      binding.moduleSpecifier !== moduleSpecifier
    ) {
      failures.push(`source authority cannot resolve Core router factory binding ${name} from ${moduleSpecifier}`)
    }
  }

  const actual = new Set()
  const accepted = new Set()
  const rejected = new Set()
  for (const statement of factory.body.statements) {
    const call = expressionCall(statement)
    if (
      !call ||
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.getText(parsed) !== 'app.use' ||
      call.arguments.length < 2
    ) continue
    const prefix = call.arguments[0]
    const router = call.arguments[1]
    if (!isStringLiteral(prefix)) {
      failures.push('unsupported dynamic Core mount prefix in createCoreApp')
      rejected.add(call)
      continue
    }
    const routerFactory = ts.isCallExpression(router) ? callName(router.expression) : null
    const binding = routerFactory ? imports.get(routerFactory) : null
    const authority = classifiedCoreMounts.find(([, name]) => name === routerFactory)
    if (
      !routerFactory ||
      !recognizedFactories.has(routerFactory) ||
      !binding ||
      binding.importedName !== routerFactory ||
      binding.moduleSpecifier !== authority?.[2]
    ) {
      failures.push(`unsupported indirect Core mount factory ${routerFactory ?? router.getText(parsed)} in createCoreApp`)
      rejected.add(call)
      continue
    }
    accepted.add(call)
    actual.add(`${prefix.text} -> ${routerFactory}`)
  }

  walk(parsed, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.getText(parsed) !== 'app.use' ||
      node.arguments.length < 2 ||
      accepted.has(node) ||
      rejected.has(node)
    ) return
    const prefix = node.arguments[0]
    const router = node.arguments[1]
    if (!isStringLiteral(prefix)) {
      failures.push(`unsupported dynamic Core mount prefix in ${enclosingFunctionName(node) ?? parsed.fileName}`)
      return
    }
    const routerFactory = ts.isCallExpression(router) ? callName(router.expression) : null
    if (routerFactory && recognizedFactories.has(routerFactory)) {
      failures.push(`unsupported or dead Core mount ${prefix.text} -> ${routerFactory}`)
      return
    }
    failures.push(`unsupported indirect Core mount factory ${routerFactory ?? router.getText(parsed)}`)
  })

  const expected = new Set(classifiedCoreMounts.map(([prefix, name]) => `${prefix} -> ${name}`))
  for (const mount of expected) {
    if (!actual.has(mount)) failures.push(`source authority is missing mount ${mount}`)
  }
  for (const mount of actual) {
    if (!expected.has(mount)) failures.push(`unclassified source mount ${mount}`)
  }
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

function topLevelConstant(parsed, name, kind, failures, label) {
  const matches = []
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) matches.push(declaration)
    }
  }
  if (matches.length !== 1 || !matches[0].initializer || !kind(matches[0].initializer)) {
    failures.push(`could not resolve ${label}: ${name}`)
    return null
  }
  return matches[0].initializer
}

function functionContains(functionNode, predicate) {
  let found = false
  walk(functionNode.body, (node) => {
    if (predicate(node)) found = true
  })
  return found
}

function binaryMatches(node, parsed, left, operator, right) {
  return (
    ts.isBinaryExpression(node) &&
    node.left.getText(parsed) === left &&
    node.operatorToken.kind === operator &&
    node.right.getText(parsed) === right
  )
}

function extractRegexLiteral(node) {
  if (!ts.isRegularExpressionLiteral(node)) return null
  const text = node.text
  const closingSlash = text.lastIndexOf('/')
  if (!text.startsWith('/') || closingSlash <= 0) return null
  try {
    return new RegExp(text.slice(1, closingSlash), text.slice(closingSlash + 1))
  } catch {
    return null
  }
}

function extractUploadFieldValidator(functionNode, parsed, inputValue, validatedValue, label, failures) {
  const trimGuard = functionContains(functionNode, (node) => {
    if (!ts.isBinaryExpression(node)) return false
    if (
      node.left.getText(parsed) !== inputValue ||
      node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      !ts.isCallExpression(node.right) ||
      !ts.isPropertyAccessExpression(node.right.expression)
    ) return false
    return (
      node.right.expression.name.text === 'trim' &&
      node.right.expression.expression.getText(parsed) === inputValue &&
      node.right.arguments.length === 0
    )
  })
  if (!trimGuard) {
    failures.push(`could not resolve upload source validator: ${label} trim guard`)
    return null
  }

  const minima = []
  const maxima = []
  const regexes = []
  walk(functionNode.body, (node) => {
    if (binaryMatches(
      node,
      parsed,
      `${validatedValue}.length`,
      ts.SyntaxKind.LessThanToken,
      node.right?.getText?.(parsed) ?? '',
    ) && ts.isNumericLiteral(node.right)) minima.push(Number(node.right.text))
    if (binaryMatches(
      node,
      parsed,
      `${validatedValue}.length`,
      ts.SyntaxKind.GreaterThanToken,
      node.right?.getText?.(parsed) ?? '',
    ) && ts.isNumericLiteral(node.right)) maxima.push(Number(node.right.text))
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'test' &&
      node.arguments.length === 1 &&
      node.arguments[0].getText(parsed) === validatedValue
    ) {
      const regex = extractRegexLiteral(node.expression.expression)
      if (regex) regexes.push(regex)
    }
  })
  if (
    minima.length !== 1 ||
    maxima.length !== 1 ||
    regexes.length !== 1 ||
    !Number.isSafeInteger(minima[0]) ||
    !Number.isSafeInteger(maxima[0])
  ) {
    failures.push(`could not resolve upload source validator: ${label} bounds or forbidden-character regex`)
    return null
  }
  return { trimmed: true, minimum: minima[0], maximum: maxima[0], forbidden: regexes[0] }
}

function extractUploadConstraints(source, failures) {
  if (source === null || source === undefined) return null
  const relative = 'services/core-api/src/uploads/service.ts'
  const parsed = parseTypeScript(relative, source, failures)
  const maximum = topLevelConstant(
    parsed,
    'MAX_DATABASE_BIGINT',
    ts.isBigIntLiteral,
    failures,
    'upload source validator',
  )
  const canonical = findNamedFunction(parsed, 'canonicalPositiveBigInt', failures)
  const upload = findNamedFunction(parsed, 'parseUploadIntent', failures)
  if (!maximum || !canonical || !upload) return null
  if (!functionContains(canonical, (node) => binaryMatches(
    node,
    parsed,
    'parsed',
    ts.SyntaxKind.GreaterThanToken,
    'MAX_DATABASE_BIGINT',
  ))) {
    failures.push('could not resolve upload source validator: canonical maximum guard')
    return null
  }
  if (!functionContains(upload, (node) => (
    ts.isPropertyAssignment(node) &&
    node.name.getText(parsed) === 'sizeBytes' &&
    ts.isCallExpression(node.initializer) &&
    callName(node.initializer.expression) === 'canonicalPositiveBigInt' &&
    node.initializer.arguments[0]?.getText(parsed) === 'body.sizeBytes'
  ))) {
    failures.push('could not resolve upload source validator: sizeBytes call')
    return null
  }
  const fileName = extractUploadFieldValidator(
    upload,
    parsed,
    'body.fileName',
    'fileName',
    'fileName',
    failures,
  )
  const mimeType = extractUploadFieldValidator(
    upload,
    parsed,
    'body.mimeType',
    'body.mimeType',
    'mimeType',
    failures,
  )
  if (!fileName || !mimeType) return null
  return {
    maximumDecimal: maximum.text.replaceAll('_', '').replace(/n$/, ''),
    fileName,
    mimeType,
  }
}

function extractShareConstraints(source, failures) {
  if (source === null || source === undefined) return null
  const relative = 'services/core-api/src/sharing/service.ts'
  const parsed = parseTypeScript(relative, source, failures)
  const maximum = topLevelConstant(
    parsed,
    'PASSWORD_MAX_BYTES',
    ts.isNumericLiteral,
    failures,
    'sharing source validator',
  )
  const validator = findNamedFunction(parsed, 'validSharePassword', failures)
  if (!maximum || !validator) return null
  const returns = validator.body.statements.filter(ts.isReturnStatement)
  if (returns.length !== 1 || !returns[0].expression) {
    failures.push('could not resolve sharing source validator: validSharePassword return')
    return null
  }
  const expression = returns[0].expression
  const hasStringGuard = functionContains({ body: expression }, (node) => (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    node.left.kind === ts.SyntaxKind.TypeOfExpression &&
    node.left.expression.getText(parsed) === 'password' &&
    isStringLiteral(node.right) &&
    node.right.text === 'string'
  ))
  const hasNonemptyGuard = functionContains({ body: expression }, (node) => binaryMatches(
    node,
    parsed,
    'password.length',
    ts.SyntaxKind.GreaterThanToken,
    '0',
  ))
  const hasByteGuard = functionContains({ body: expression }, (node) => {
    if (
      !ts.isBinaryExpression(node) ||
      node.operatorToken.kind !== ts.SyntaxKind.LessThanEqualsToken ||
      node.right.getText(parsed) !== 'PASSWORD_MAX_BYTES' ||
      !ts.isCallExpression(node.left) ||
      !ts.isPropertyAccessExpression(node.left.expression) ||
      node.left.expression.getText(parsed) !== 'Buffer.byteLength'
    ) return false
    return (
      node.left.arguments[0]?.getText(parsed) === 'password' &&
      isStringLiteral(node.left.arguments[1]) &&
      node.left.arguments[1].text === 'utf8'
    )
  })
  if (!hasStringGuard || !hasNonemptyGuard || !hasByteGuard) {
    failures.push('could not resolve sharing source validator: validSharePassword semantics')
    return null
  }
  return { minimum: 1, maximumUtf8Bytes: Number(maximum.text.replaceAll('_', '')) }
}

function sourceConstraints(sources, failures) {
  return {
    upload: extractUploadConstraints(
      sources.get('services/core-api/src/uploads/service.ts'),
      failures,
    ),
    share: extractShareConstraints(
      sources.get('services/core-api/src/sharing/service.ts'),
      failures,
    ),
  }
}

function verifyOpenApi(document, failures, constraints) {
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

  verifyOpenApiSchemas(document, failures, constraints)
}

function fieldPatternMatchesSource(schema, constraint) {
  if (typeof schema?.pattern !== 'string') return false
  let openApiPattern
  try {
    openApiPattern = new RegExp(schema.pattern)
  } catch {
    return false
  }
  const sourceAccepts = (value) => {
    constraint.forbidden.lastIndex = 0
    return (
      value.length >= constraint.minimum &&
      (!constraint.trimmed || value === value.trim()) &&
      !constraint.forbidden.test(value)
    )
  }
  const openApiAccepts = (value) => {
    openApiPattern.lastIndex = 0
    return Array.from(value).length >= schema.minLength && openApiPattern.test(value)
  }
  const matches = (value) => sourceAccepts(value) === openApiAccepts(value)
  for (const value of ['', 'a', 'a b', ' leading', 'trailing ', '/', '\\', '😀']) {
    if (!matches(value)) return false
  }
  for (let codeUnit = 0; codeUnit <= 0xffff; codeUnit += 1) {
    const character = String.fromCharCode(codeUnit)
    if (!matches(character) || !matches(`a${character}b`)) return false
    if (character !== character.trim()) {
      if (!matches(`${character}a`) || !matches(`a${character}`)) return false
    }
  }
  return true
}

function verifyOpenApiSchemas(document, failures, constraints) {
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
  if (
    constraints.upload &&
    schemas.PositiveByteString?.['x-maximum-decimal'] !== constraints.upload.maximumDecimal
  ) {
    failures.push(`PositiveByteString must declare signed 64-bit maximum ${constraints.upload.maximumDecimal}`)
    failures.push('PositiveByteString maximum does not match upload source validator')
  }

  const fileName = schemas.UploadFileName
  if (constraints.upload) {
    if (
      fileName?.['x-trimmed'] !== constraints.upload.fileName.trimmed ||
      fileName?.minLength !== constraints.upload.fileName.minimum ||
      fileName?.['x-max-js-utf16-code-units'] !== constraints.upload.fileName.maximum ||
      'maxLength' in (fileName ?? {})
    ) {
      failures.push('UploadFileName must require trimmed input and forbid slash, backslash, control, and DEL characters')
    }
    if (!fieldPatternMatchesSource(fileName, constraints.upload.fileName)) {
      failures.push('UploadFileName pattern does not match upload source validator')
    }
  }

  const mimeType = schemas.UploadMimeType
  if (constraints.upload) {
    if (
      mimeType?.['x-trimmed'] !== constraints.upload.mimeType.trimmed ||
      mimeType?.minLength !== constraints.upload.mimeType.minimum ||
      mimeType?.['x-max-js-utf16-code-units'] !== constraints.upload.mimeType.maximum ||
      'maxLength' in (mimeType ?? {})
    ) {
      failures.push('UploadMimeType must require trimmed input and forbid control and DEL characters')
    }
    if (!fieldPatternMatchesSource(mimeType, constraints.upload.mimeType)) {
      failures.push('UploadMimeType pattern does not match upload source validator')
    }
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
  if (constraints.share && (
    password?.['x-max-utf8-bytes'] !== constraints.share.maximumUtf8Bytes ||
    password?.minLength !== constraints.share.minimum ||
    'maxLength' in (password ?? {})
  )) {
    failures.push(`SharePassword must declare a ${constraints.share.maximumUtf8Bytes}-byte UTF-8 limit`)
    failures.push('SharePassword byte limit does not match sharing source validator')
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

async function verifyStorageRuntimeContract(root, failures) {
  const relative = 'services/storage/src/__tests__/completion-parser-contract.test.ts'
  let source
  try {
    source = await readFile(path.join(root, relative), 'utf8')
  } catch {
    failures.push('persistent Storage completion parser runtime contract is missing')
    return
  }
  const parsed = parseTypeScript(relative, source, failures)
  let contractBody = null
  walk(parsed, (node) => {
    if (
      ts.isCallExpression(node) &&
      callName(node.expression) === 'test' &&
      isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === 'preserves Express default HTML for oversized completion JSON' &&
      (ts.isArrowFunction(node.arguments[1]) || ts.isFunctionExpression(node.arguments[1]))
    ) {
      contractBody = node.arguments[1].body
    }
  })
  if (!contractBody) {
    failures.push('persistent Storage completion parser runtime contract is missing')
    return
  }
  let actualApp = false
  let oversizedPost = false
  let statusAssertion = false
  let mediaAssertion = false
  let htmlAssertion = false
  walk(contractBody, (node) => {
    if (!ts.isCallExpression(node)) return
    if (callName(node.expression) === 'createStorageApiApp') {
      const object = node.arguments[0]
      if (ts.isObjectLiteralExpression(object)) {
        const router = object.properties.find(
          (property) => ts.isPropertyAssignment(property) && property.name.getText(parsed) === 'router',
        )
        actualApp = Boolean(
          router &&
          ts.isPropertyAssignment(router) &&
          ts.isCallExpression(router.initializer) &&
          callName(router.initializer.expression) === 'createStorageApi',
        )
      }
    }
    if (ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (
        method === 'post' &&
        isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === '/api/v1/storage/uploads/object-key/complete'
      ) oversizedPost = true
      if (method === 'toBe' && ts.isNumericLiteral(node.arguments[0]) && node.arguments[0].text === '413') {
        statusAssertion = true
      }
      if (
        method === 'toBe' &&
        isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === 'text/html; charset=utf-8'
      ) mediaAssertion = true
      if (
        method === 'toMatch' &&
        ts.isRegularExpressionLiteral(node.arguments[0]) &&
        node.arguments[0].text === '/^<!DOCTYPE html>/'
      ) htmlAssertion = true
    }
  })
  if (!actualApp || !oversizedPost || !statusAssertion || !mediaAssertion || !htmlAssertion) {
    failures.push('persistent Storage completion parser runtime contract is missing')
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
    if (/2026-07-(?:13|26|27)\b/.test(source)) {
      failures.push(`${relative} contains a hard-coded retirement date`)
    }
    if (relative === 'frontend/cruip-landing/README.md' && /\bNextra\s+3\b/i.test(source)) {
      failures.push(`${relative} contains a stale Nextra 3 claim`)
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
    'services/core-api/src/uploads/service.ts',
    'services/core-api/src/sharing/service.ts',
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
  const constraints = sourceConstraints(sources, failures)
  verifyOpenApi(await bundleOpenApi(root, failures), failures, constraints)
  await verifyStorageRuntimeContract(root, failures)
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
