import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const frontendRequire = createRequire(
  new URL('../frontend/cruip-landing/package.json', import.meta.url),
)
const postcss = frontendRequire('postcss')

const tokenPath = new URL('../frontend/cruip-landing/app/css/nothing-tokens.css', import.meta.url)
const accordionPath = new URL('../frontend/cruip-landing/components/accordion.tsx', import.meta.url)

function declarationsFor(root, selector) {
  const values = new Map()

  root.walkRules((rule) => {
    if (!selector(rule.selector)) return
    rule.walkDecls((declaration) => values.set(declaration.prop, declaration.value.trim()))
  })

  return values
}

function resolveToken(name, tokens, seen = new Set()) {
  assert.ok(!seen.has(name), `Token cycle while resolving ${name}`)
  seen.add(name)

  const value = tokens.get(name)
  assert.ok(value, `Missing ${name}`)
  const reference = value.match(/^var\((--[a-z0-9-]+)\)$/i)
  return reference ? resolveToken(reference[1], tokens, seen) : value
}

function parseColor(value) {
  const hex = value.match(/^#([\da-f]{6})$/i)
  if (hex) {
    const integer = Number.parseInt(hex[1], 16)
    return {
      red: (integer >> 16) & 255,
      green: (integer >> 8) & 255,
      blue: integer & 255,
      alpha: 1,
    }
  }

  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/i,
  )
  assert.ok(rgb, `Unsupported color format: ${value}`)
  return {
    red: Number(rgb[1]),
    green: Number(rgb[2]),
    blue: Number(rgb[3]),
    alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
  }
}

function luminance({ red, green, blue }) {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(first, second) {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

test('accordion focus indicator meets WCAG 1.4.11 in light and dark themes', async () => {
  const [tokenSource, accordionSource] = await Promise.all([
    readFile(tokenPath, 'utf8'),
    readFile(accordionPath, 'utf8'),
  ])
  const root = postcss.parse(tokenSource, { from: tokenPath.pathname })
  const darkTokens = declarationsFor(root, (selector) => selector.trim() === ':root')
  const lightTokens = new Map([
    ...darkTokens,
    ...declarationsFor(root, (selector) => selector.includes('[data-theme="light"]')),
  ])

  for (const [theme, tokens] of [['dark', darkTokens], ['light', lightTokens]]) {
    const focus = parseColor(resolveToken('--nothing-focus', tokens))
    assert.equal(focus.alpha, 1, `${theme} focus color must be opaque`)

    for (const surfaceName of ['--nothing-bg', '--nothing-surface', '--nothing-raised']) {
      const surface = parseColor(resolveToken(surfaceName, tokens))
      const ratio = contrastRatio(focus, surface)
      assert.ok(
        ratio >= 3,
        `${theme} ${surfaceName} focus contrast ${ratio.toFixed(2)} must be at least 3:1`,
      )
    }
  }

  assert.match(accordionSource, /focus-visible:outline-2/)
  assert.match(accordionSource, /focus-visible:outline-offset-2/)
  assert.match(accordionSource, /focus-visible:outline-nothing-focus/)
  assert.doesNotMatch(accordionSource, /focus-visible:outline-none/)
})
