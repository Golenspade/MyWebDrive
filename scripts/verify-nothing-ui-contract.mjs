#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const frontendRequire = createRequire(
  new URL('../frontend/cruip-landing/package.json', import.meta.url),
)
const postcss = frontendRequire('postcss')

const SOURCE_ROOTS = [
  'frontend/cruip-landing/app',
  'frontend/cruip-landing/components',
]
const SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx', '.js', '.jsx'])
const TOKEN_AUTHORITY_PATH = 'frontend/cruip-landing/app/css/nothing-tokens.css'
const NOTHING_BASE_PATH = 'frontend/cruip-landing/app/css/nothing-base.css'
const DOT_FIELD_SELECTORS = new Set(['body::before', '.appwrap::before'])
const DOT_FIELD_PROPERTY = 'background-image'
const DOT_FIELD_VALUE =
  'radial-gradient(rgba(255, 255, 255, 0.42) 1.3px, transparent 1.7px)'
const DYNAMIC_CSS_VALUE = 'var(--nothing-ui-dynamic)'
const DYNAMIC_TEMPLATE_MARKER = '${}'

export const LEGACY_BRAND_TOKENS = Object.freeze([
  'brand-primary',
  'brand-primary-50',
  'brand-primary-100',
  'brand-primary-200',
  'brand-primary-300',
  'brand-primary-400',
  'brand-primary-500',
  'brand-primary-600',
  'brand-primary-700',
  'brand-primary-800',
  'brand-primary-900',
  'brand-primary-950',
  'brand-accent',
  'brand-accent-50',
  'brand-accent-100',
  'brand-accent-200',
  'brand-accent-300',
  'brand-accent-400',
  'brand-accent-500',
  'brand-accent-600',
  'brand-accent-700',
  'brand-accent-800',
  'brand-accent-900',
  'brand-accent-950',
])

const legacyBrandPattern = new RegExp(
  `(?<![A-Za-z0-9])(?:${[...LEGACY_BRAND_TOKENS]
    .sort((left, right) => right.length - left.length)
    .join('|')})(?![A-Za-z0-9-])`,
  'g',
)
const gradientFunctionPattern =
  /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/gi
const dropShadowFunctionPattern = /drop-shadow\s*\(/i
const hexColorPattern = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\da-f])/gi

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join('/')
}

function lineAndColumn(source, offset) {
  const prefix = source.slice(0, offset)
  const lines = prefix.split('\n')
  return { line: lines.length, column: lines.at(-1).length + 1 }
}

function violation(relativePath, rule, message, location = {}) {
  return {
    relativePath,
    rule,
    message,
    line: location.line ?? 1,
    column: location.column ?? 1,
  }
}

function stripVariantPrefixes(token) {
  let bracketDepth = 0
  let lastVariantSeparator = -1

  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === '[') bracketDepth += 1
    if (token[index] === ']') bracketDepth = Math.max(0, bracketDepth - 1)
    if (token[index] === ':' && bracketDepth === 0) lastVariantSeparator = index
  }

  return token.slice(lastVariantSeparator + 1).replace(/^!/, '')
}

function normalizeArbitraryCssValue(value) {
  const escapedUnderscore = '\0'
  return value
    .replace(/\\_/g, escapedUnderscore)
    .replace(/_/g, ' ')
    .replaceAll(escapedUnderscore, '_')
    .trim()
    .toLowerCase()
}

function arbitraryShadowValue(token) {
  const match = token.match(/^\[(?:box|text)-shadow:(.*)\]$/i)
  return match ? normalizeArbitraryCssValue(match[1]) : null
}

function normalizeStyleProperty(property) {
  const normalized = property
    .replace(/^-(?:webkit|moz|ms|o)-/i, '')
    .replace(/[-_]/g, '')
    .toLowerCase()

  return normalized.replace(/^(?:webkit|moz|ms|o)(?=mask)/, '')
}

function isFlatShadowValue(value) {
  return normalizeArbitraryCssValue(value) === 'none'
}

function findTailwindViolations(value) {
  const findings = []

  for (const rawToken of value.split(/\s+/)) {
    const token = stripVariantPrefixes(rawToken.trim())
    if (!token) continue

    const arbitraryValue = arbitraryShadowValue(token)

    if (
      token !== 'shadow-none' &&
      token !== 'drop-shadow-none' &&
      (
        token === 'shadow' ||
        token.startsWith('shadow-') ||
        token === 'drop-shadow' ||
        token.startsWith('drop-shadow-') ||
        (arbitraryValue !== null && !isFlatShadowValue(arbitraryValue))
      )
    ) {
      findings.push({ rule: 'positive-shadow', message: `Positive shadow utility: ${token}` })
    }

    if (/^bg-(?:gradient|linear|radial|conic)(?:-|$)/i.test(token)) {
      findings.push({ rule: 'gradient', message: `Gradient utility: ${token}` })
    }

    if (/^(?:\[(?:-webkit-)?mask(?:-[^:]+)?:|(?:-webkit-)?mask(?:-|$))/i.test(token)) {
      findings.push({ rule: 'mask', message: `Mask utility: ${token}` })
    }
  }

  return findings
}

function withoutUrlFragments(value) {
  return value
    .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, '')
    .replace(/(?:https?:\/\/|\.{0,2}\/)[^\s"'<>]*#[A-Za-z0-9_-]+/g, '')
}

function scanTextValue({ relativePath, source, value, offset = 0, ignoreHex = false }) {
  const findings = []
  const location = lineAndColumn(source, offset)

  for (const finding of findTailwindViolations(value)) {
    findings.push(violation(relativePath, finding.rule, finding.message, location))
  }

  if (gradientFunctionPattern.test(value)) {
    findings.push(violation(relativePath, 'gradient', 'Gradient declarations are forbidden', location))
  }
  gradientFunctionPattern.lastIndex = 0

  if (dropShadowFunctionPattern.test(value)) {
    findings.push(violation(relativePath, 'positive-shadow', 'Drop shadows are forbidden', location))
  }

  legacyBrandPattern.lastIndex = 0
  for (const match of value.matchAll(legacyBrandPattern)) {
    findings.push(
      violation(relativePath, 'legacy-brand-token', `Legacy brand token: ${match[0]}`, location),
    )
  }

  if (relativePath !== TOKEN_AUTHORITY_PATH && !ignoreHex) {
    const valueWithoutUrls = withoutUrlFragments(value)
    hexColorPattern.lastIndex = 0
    for (const match of valueWithoutUrls.matchAll(hexColorPattern)) {
      findings.push(violation(relativePath, 'raw-hex-color', `Raw hex color: ${match[0]}`, location))
    }
  }

  return findings
}

function isAllowedDotFieldDeclaration(relativePath, declaration) {
  if (relativePath !== NOTHING_BASE_PATH) return false
  if (declaration.prop !== DOT_FIELD_PROPERTY) return false
  if (declaration.value.trim() !== DOT_FIELD_VALUE) return false
  if (declaration.important) return false
  if (declaration.parent?.type !== 'rule' || declaration.parent.parent?.type !== 'root') return false

  return DOT_FIELD_SELECTORS.has(declaration.parent.selector.trim())
}

function dotFieldContractFindings(source) {
  const root = postcss.parse(source, { from: NOTHING_BASE_PATH })
  const exactDeclarations = new Map(
    [...DOT_FIELD_SELECTORS].map((selector) => [selector, []]),
  )

  root.walkDecls((declaration) => {
    if (!isAllowedDotFieldDeclaration(NOTHING_BASE_PATH, declaration)) return
    exactDeclarations.get(declaration.parent.selector.trim()).push(declaration)
  })

  const findings = []
  for (const [selector, declarations] of exactDeclarations) {
    if (declarations.length === 1) continue
    const location = declarations[1]?.source?.start ?? declarations[0]?.source?.start ?? {
      line: 1,
      column: 1,
    }
    findings.push(
      violation(
        NOTHING_BASE_PATH,
        'dot-field-contract',
        `Expected exactly one top-level, non-important ${selector} ${DOT_FIELD_PROPERTY} declaration; found ${declarations.length}`,
        location,
      ),
    )
  }

  return findings
}

function scanCss({ relativePath, source }) {
  const root = postcss.parse(source, { from: relativePath })
  const findings = []

  root.walkDecls((declaration) => {
    const property = normalizeStyleProperty(declaration.prop)
    const value = declaration.value
    const location = declaration.source?.start ?? { line: 1, column: 1 }
    const allowedDotField = isAllowedDotFieldDeclaration(relativePath, declaration)

    if (
      (property === 'boxshadow' || property === 'textshadow') &&
      !isFlatShadowValue(value)
    ) {
      findings.push(
        violation(relativePath, 'positive-shadow', `Positive ${declaration.prop} declaration`, location),
      )
    }

    if (property.startsWith('mask')) {
      findings.push(violation(relativePath, 'mask', `Mask property: ${declaration.prop}`, location))
    }

    if (property === 'filter' && value.includes(DYNAMIC_CSS_VALUE)) {
      findings.push(
        violation(relativePath, 'positive-shadow', 'Dynamic filter may produce a drop shadow', location),
      )
    }

    if (
      (property === 'background' || property === 'backgroundimage') &&
      value.includes(DYNAMIC_CSS_VALUE)
    ) {
      findings.push(
        violation(relativePath, 'gradient', 'Dynamic background may produce a gradient', location),
      )
    }

    if (!allowedDotField && gradientFunctionPattern.test(value)) {
      findings.push(violation(relativePath, 'gradient', 'Gradient declarations are forbidden', location))
    }
    gradientFunctionPattern.lastIndex = 0

    findings.push(
      ...scanTextValue({
        relativePath,
        source,
        value,
        offset: declaration.source?.start?.offset ?? 0,
      }).filter(({ rule }) => rule !== 'gradient' || !allowedDotField),
    )
    findings.push(
      ...scanTextValue({
        relativePath,
        source,
        value: declaration.prop,
        offset: declaration.source?.start?.offset ?? 0,
        ignoreHex: true,
      }).filter(({ rule }) => rule === 'legacy-brand-token'),
    )
  })

  root.walkAtRules((atRule) => {
    findings.push(
      ...scanTextValue({
        relativePath,
        source,
        value: atRule.params,
        offset: atRule.source?.start?.offset ?? 0,
      }),
    )
  })

  root.walkRules((rule) => {
    findings.push(
      ...scanTextValue({
        relativePath,
        source,
        value: rule.selector,
        offset: rule.source?.start?.offset ?? 0,
        ignoreHex: true,
      }).filter(({ rule: findingRule }) => findingRule === 'legacy-brand-token'),
    )
  })

  return deduplicateFindings(findings)
}

function scriptKindFor(relativePath) {
  const extension = path.extname(relativePath)
  if (extension === '.tsx') return ts.ScriptKind.TSX
  if (extension === '.jsx') return ts.ScriptKind.JSX
  if (extension === '.js') return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function propertyName(node) {
  if (!node) return ''
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text
  if (
    ts.isComputedPropertyName(node) &&
    (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
  ) {
    return node.expression.text
  }
  return ''
}

function isFragmentAttribute(node) {
  if (!ts.isStringLiteral(node) || !ts.isJsxAttribute(node.parent)) return false
  return ['href', 'xlinkHref'].includes(node.parent.name.getText())
}

function isCssTaggedTemplate(node) {
  if (!ts.isTaggedTemplateExpression(node)) return false
  const tag = node.tag.getText()
  return /^(?:css(?:\b|\.)|styled(?:\b|\.|\())/.test(tag)
}

function templateText(template, interpolationValue) {
  if (ts.isNoSubstitutionTemplateLiteral(template)) return template.text

  let value = template.head.text
  for (const span of template.templateSpans) {
    value += interpolationValue
    value += span.literal.text
  }
  return value
}

function dynamicTemplateFindings({ relativePath, source, value, offset }) {
  const findings = []
  const location = lineAndColumn(source, offset)

  if (/(?:^|\s)(?:[\w-]+:)*bg-\$\{\}-(?:to-[\w-]+|gradient|linear|radial|conic)(?=\s|$)/i.test(value)) {
    findings.push(
      violation(relativePath, 'gradient', 'Dynamic Tailwind template may produce a gradient', location),
    )
  }

  if (/(?:^|[^A-Za-z0-9])brand-(?:\$\{\}|primary-\$\{\}|accent-\$\{\})/i.test(value)) {
    findings.push(
      violation(
        relativePath,
        'legacy-brand-token',
        'Dynamic Tailwind template may produce a legacy brand token',
        location,
      ),
    )
  }

  return findings
}

function scanScript({ relativePath, source }) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(relativePath),
  )

  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostic = sourceFile.parseDiagnostics[0]
    const location = lineAndColumn(source, diagnostic.start ?? 0)
    throw new Error(
      `${relativePath}:${location.line}:${location.column}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`,
    )
  }

  const findings = []

  function visit(node) {
    if (isCssTaggedTemplate(node)) {
      const cssSource = templateText(node.template, DYNAMIC_CSS_VALUE)
      const location = lineAndColumn(source, node.template.getStart(sourceFile))
      const cssFindings = scanCss({ relativePath, source: cssSource })
      findings.push(
        ...cssFindings.map((finding) => ({
          ...finding,
          line: location.line + finding.line - 1,
          column: finding.line === 1 ? location.column + finding.column - 1 : finding.column,
        })),
      )

      if (ts.isTemplateExpression(node.template)) {
        for (const span of node.template.templateSpans) visit(span.expression)
      }
      return
    }

    if (ts.isTemplateExpression(node)) {
      const value = templateText(node, DYNAMIC_TEMPLATE_MARKER)
      const offset = node.getStart(sourceFile)
      findings.push(...scanTextValue({ relativePath, source, value, offset }))
      findings.push(...dynamicTemplateFindings({ relativePath, source, value, offset }))
      for (const span of node.templateSpans) visit(span.expression)
      return
    }

    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      findings.push(
        ...scanTextValue({
          relativePath,
          source,
          value: node.text,
          offset: node.getStart(sourceFile),
          ignoreHex: isFragmentAttribute(node),
        }),
      )
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name)
      const normalizedName = normalizeStyleProperty(name)
      const rawValue = node.initializer.getText(sourceFile).replace(/^['"`]|['"`]$/g, '').trim()
      const location = lineAndColumn(source, node.getStart(sourceFile))

      if (
        (normalizedName === 'boxshadow' || normalizedName === 'textshadow') &&
        !isFlatShadowValue(rawValue)
      ) {
        findings.push(violation(relativePath, 'positive-shadow', `Positive ${name} value`, location))
      }

      if (normalizedName.startsWith('mask')) {
        findings.push(violation(relativePath, 'mask', `Mask property: ${name}`, location))
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile)
      const location = lineAndColumn(source, node.getStart(sourceFile))

      if (/(?:^|\.)(?:linear|radial)Gradient$/.test(tagName)) {
        findings.push(
          violation(
            relativePath,
            'gradient',
            `SVG gradient element: ${tagName}`,
            location,
          ),
        )
      }

      if (/(?:^|\.)mask$/.test(tagName)) {
        findings.push(violation(relativePath, 'mask', 'SVG mask element', location))
      }

      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          normalizeStyleProperty(attribute.name.getText(sourceFile)).startsWith('mask')
        ) {
          findings.push(
            violation(
              relativePath,
              'mask',
              `JSX mask attribute: ${attribute.name.getText(sourceFile)}`,
              lineAndColumn(source, attribute.getStart(sourceFile)),
            ),
          )
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return deduplicateFindings(findings)
}

function deduplicateFindings(findings) {
  const seen = new Set()

  return findings.filter((finding) => {
    const key = [finding.relativePath, finding.rule, finding.message, finding.line, finding.column].join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function scanSource({ relativePath, source }) {
  const normalizedPath = normalizeRelativePath(relativePath)
  if (path.extname(normalizedPath) === '.css') {
    return scanCss({ relativePath: normalizedPath, source })
  }

  return scanScript({ relativePath: normalizedPath, source })
}

async function walkSourceTree(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkSourceTree(entryPath)))
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath)
    }
  }

  return files
}

export async function scanFile(filePath, repoRoot = process.cwd()) {
  const source = await readFile(filePath, 'utf8')
  const relativePath = normalizeRelativePath(path.relative(repoRoot, filePath))
  return scanSource({ relativePath, source })
}

export async function scanUiContract({ repoRoot = process.cwd() } = {}) {
  const files = []

  for (const sourceRoot of SOURCE_ROOTS) {
    files.push(...(await walkSourceTree(path.join(repoRoot, sourceRoot))))
  }

  files.sort()
  const sourcePaths = new Set(
    files.map((filePath) => normalizeRelativePath(path.relative(repoRoot, filePath))),
  )
  if (!sourcePaths.has(TOKEN_AUTHORITY_PATH)) {
    throw new Error(`Nothing token authority is missing: ${TOKEN_AUTHORITY_PATH}`)
  }

  const findings = []
  const dotFieldPath = files.find(
    (filePath) => normalizeRelativePath(path.relative(repoRoot, filePath)) === NOTHING_BASE_PATH,
  )
  if (dotFieldPath) {
    findings.push(...dotFieldContractFindings(await readFile(dotFieldPath, 'utf8')))
  } else {
    for (const selector of DOT_FIELD_SELECTORS) {
      findings.push(
        violation(
          NOTHING_BASE_PATH,
          'dot-field-contract',
          `Expected exactly one top-level, non-important ${selector} ${DOT_FIELD_PROPERTY} declaration; found 0`,
        ),
      )
    }
  }

  for (const filePath of files) {
    findings.push(...(await scanFile(filePath, repoRoot)))
  }

  return findings
}

export async function runCli({ repoRoot = process.cwd() } = {}) {
  const findings = await scanUiContract({ repoRoot })

  if (findings.length === 0) {
    process.stdout.write('Nothing UI contract passed.\n')
    return 0
  }

  for (const finding of findings) {
    process.stderr.write(
      `${finding.relativePath}:${finding.line}:${finding.column} [${finding.rule}] ${finding.message}\n`,
    )
  }
  process.stderr.write(`Nothing UI contract failed with ${findings.length} violation(s).\n`)
  return 1
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isCli) {
  runCli()
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error) => {
      process.stderr.write(`Nothing UI contract scan failed closed: ${error.stack ?? error.message}\n`)
      process.exitCode = 1
    })
}
