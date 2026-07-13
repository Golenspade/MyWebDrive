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

function findTailwindViolations(value) {
  const findings = []

  for (const rawToken of value.split(/\s+/)) {
    const token = stripVariantPrefixes(rawToken.trim())
    if (!token) continue

    if (
      token !== 'shadow-none' &&
      (token === 'shadow' || token.startsWith('shadow-') || /^\[box-shadow:/i.test(token))
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
  if (declaration.prop.toLowerCase() !== DOT_FIELD_PROPERTY) return false
  if (declaration.value.trim() !== DOT_FIELD_VALUE) return false

  const parentSelector = declaration.parent?.type === 'rule' ? declaration.parent.selector : ''
  return DOT_FIELD_SELECTORS.has(parentSelector.trim())
}

function scanCss({ relativePath, source }) {
  const root = postcss.parse(source, { from: relativePath })
  const findings = []

  root.walkDecls((declaration) => {
    const property = declaration.prop.toLowerCase()
    const value = declaration.value
    const location = declaration.source?.start ?? { line: 1, column: 1 }
    const allowedDotField = isAllowedDotFieldDeclaration(relativePath, declaration)

    if (/(?:^|-)box-shadow$/.test(property) && value.trim().toLowerCase() !== 'none') {
      findings.push(
        violation(relativePath, 'positive-shadow', `Positive ${declaration.prop} declaration`, location),
      )
    }

    if (/^(?:-webkit-)?mask(?:-.+)?$/.test(property)) {
      findings.push(violation(relativePath, 'mask', `Mask property: ${declaration.prop}`, location))
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
  return ''
}

function isFragmentAttribute(node) {
  if (!ts.isStringLiteral(node) || !ts.isJsxAttribute(node.parent)) return false
  return ['href', 'xlinkHref'].includes(node.parent.name.getText())
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
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
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
      const rawValue = node.initializer.getText(sourceFile).replace(/^['"`]|['"`]$/g, '').trim()
      const location = lineAndColumn(source, node.getStart(sourceFile))

      if (name === 'boxShadow' && rawValue.toLowerCase() !== 'none') {
        findings.push(violation(relativePath, 'positive-shadow', 'Positive boxShadow value', location))
      }

      if (name === 'mask' || name === 'maskImage' || name === 'WebkitMask') {
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
          ['mask', 'maskImage'].includes(attribute.name.getText(sourceFile))
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
