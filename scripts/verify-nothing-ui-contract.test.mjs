import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  LEGACY_BRAND_TOKENS,
  scanFile,
  scanSource,
  scanUiContract,
} from './verify-nothing-ui-contract.mjs'

const scriptPath = fileURLToPath(new URL('./verify-nothing-ui-contract.mjs', import.meta.url))
const tokenPath = 'frontend/cruip-landing/app/css/nothing-tokens.css'
const basePath = 'frontend/cruip-landing/app/css/nothing-base.css'
const componentPath = 'frontend/cruip-landing/components/example.tsx'
const dotFieldValue = 'radial-gradient(rgba(255, 255, 255, 0.42) 1.3px, transparent 1.7px)'
const exactDotFieldCss = `
body::before {
  background-image: ${dotFieldValue};
}
.appwrap::before {
  background-image: ${dotFieldValue};
}
`

const expectedLegacyBrandTokens = [
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
]

function rulesFor(relativePath, source) {
  return scanSource({ relativePath, source }).map(({ rule }) => rule)
}

async function withFixture(run) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'nothing-ui-contract-'))

  try {
    await mkdir(path.join(repoRoot, 'frontend/cruip-landing/app'), { recursive: true })
    await mkdir(path.join(repoRoot, 'frontend/cruip-landing/components'), { recursive: true })
    await mkdir(path.join(repoRoot, 'frontend/cruip-landing/app/css'), { recursive: true })
    await writeFile(
      path.join(repoRoot, tokenPath),
      ':root { --nothing-display: #fff; }',
    )
    await writeFile(path.join(repoRoot, basePath), exactDotFieldCss)
    return await run(repoRoot)
  } finally {
    await rm(repoRoot, { recursive: true, force: true })
  }
}

test('allows shadow-none and ignores forbidden-looking words in comments', () => {
  const source = `
    // shadow-lg linear-gradient(red, blue) #fff brand-primary-500
    export const Example = () => <div className="shadow-none" />
  `

  assert.deepEqual(rulesFor(componentPath, source), [])
})

test('rejects positive Tailwind shadows including arbitrary values', () => {
  const source = `
    export const Example = () => (
      <><div className="shadow shadow-lg" /><div className="shadow-[0_2px_4px_rgb(0_0_0/.2)]" /></>
    )
  `

  assert.equal(rulesFor(componentPath, source).filter((rule) => rule === 'positive-shadow').length, 3)
})

test('allows explicit CSS box-shadow none and rejects other values', () => {
  assert.deepEqual(rulesFor('frontend/cruip-landing/app/example.css', '.flat { box-shadow: none; }'), [])
  assert.deepEqual(
    rulesFor('frontend/cruip-landing/app/example.css', '.raised { box-shadow: 0 2px 4px rgb(0 0 0 / .2); }'),
    ['positive-shadow'],
  )
})

test('allows raw hex colors only in the Nothing token authority file', () => {
  assert.deepEqual(rulesFor(tokenPath, ':root { --nothing-display: #fff; }'), [])
  assert.deepEqual(rulesFor(componentPath, 'export const color = "#ffffff"'), ['raw-hex-color'])
})

test('does not treat CSS URL fragments or JSX anchors as raw hex colors', () => {
  const css = '.icon { filter: url(#abc); background-image: url("/sprite.svg#abcdef"); }'
  const tsx = 'export const Links = () => <><a href="#abc">A</a><use href="/icons.svg#abcdef" /></>'

  assert.deepEqual(rulesFor('frontend/cruip-landing/app/example.css', css), [])
  assert.deepEqual(rulesFor(componentPath, tsx), [])
})

test('allows only the exact Nothing dot-field gradient declarations', () => {
  assert.deepEqual(rulesFor(basePath, exactDotFieldCss), [])
})

test('project scan requires exactly one declaration for each dot-field selector', async (t) => {
  await t.test('accepts the exact top-level pair', async () => {
    await withFixture(async (repoRoot) => {
      assert.deepEqual(await scanUiContract({ repoRoot }), [])
    })
  })

  await t.test('rejects a missing selector', async () => {
    await withFixture(async (repoRoot) => {
      await writeFile(
        path.join(repoRoot, basePath),
        `body::before { background-image: ${dotFieldValue}; }`,
      )

      const rules = (await scanUiContract({ repoRoot })).map(({ rule }) => rule)
      assert.ok(rules.includes('dot-field-contract'))
    })
  })

  await t.test('rejects duplicate exact declarations', async () => {
    await withFixture(async (repoRoot) => {
      await writeFile(
        path.join(repoRoot, basePath),
        `${exactDotFieldCss}\nbody::before { background-image: ${dotFieldValue}; }`,
      )

      const violations = await scanUiContract({ repoRoot })
      assert.ok(violations.some(({ rule }) => rule === 'dot-field-contract'))
    })
  })

  await t.test('rejects combined selectors and extra selector declarations', async () => {
    await withFixture(async (repoRoot) => {
      await writeFile(
        path.join(repoRoot, basePath),
        `
          body::before, .appwrap::before { background-image: ${dotFieldValue}; }
          .other::before { background-image: ${dotFieldValue}; }
        `,
      )

      const rules = (await scanUiContract({ repoRoot })).map(({ rule }) => rule)
      assert.equal(rules.filter((rule) => rule === 'dot-field-contract').length, 2)
      assert.ok(rules.includes('gradient'))
    })
  })

  await t.test('rejects nested and important lookalikes', async () => {
    await withFixture(async (repoRoot) => {
      await writeFile(
        path.join(repoRoot, basePath),
        `
          @media (min-width: 1px) {
            body::before { background-image: ${dotFieldValue}; }
          }
          .appwrap::before { background-image: ${dotFieldValue} !important; }
        `,
      )

      const rules = (await scanUiContract({ repoRoot })).map(({ rule }) => rule)
      assert.equal(rules.filter((rule) => rule === 'dot-field-contract').length, 2)
      assert.ok(rules.includes('gradient'))
    })
  })
})

test('rejects another gradient and mask even inside nothing-base.css', () => {
  const source = `
    body::before {
      background-image: radial-gradient(rgba(255, 255, 255, 0.42) 1.3px, transparent 1.7px);
    }
    .other {
      background: linear-gradient(red, blue);
      mask-image: url(mask.svg);
    }
  `

  assert.deepEqual(rulesFor(basePath, source), ['gradient', 'mask'])
})

test('rejects Tailwind gradient and mask utilities', () => {
  const source = `
    export const Example = () => (
      <><div className="bg-gradient-to-r [mask-image:linear-gradient(black,transparent)]" /><div className="bg-linear-to-r" /></>
    )
  `

  const rules = rulesFor(componentPath, source)
  assert.equal(rules.filter((rule) => rule === 'gradient').length, 3)
  assert.ok(rules.includes('mask'))
})

test('rejects Tailwind drop shadows', () => {
  const source = `
    export const Example = () => (
      <div className="drop-shadow-md drop-shadow-[0_2px_2px_rgb(0_0_0/.2)]" />
    )
  `

  assert.equal(rulesFor(componentPath, source).filter((rule) => rule === 'positive-shadow').length, 2)
})

test('allows flat Tailwind shadow controls and rejects positive arbitrary shadows', () => {
  const allowed = `
    export const Example = () => <div className="drop-shadow-none shadow-none [box-shadow:none] hover:[box-shadow:_none] [text-shadow:none]" />
  `
  const forbidden = `
    export const Example = () => <div className="[box-shadow:0_2px_4px_rgb(0_0_0/.2)] [text-shadow:0_1px_1px_rgb(0_0_0/.2)]" />
  `

  assert.deepEqual(rulesFor(componentPath, allowed), [])
  assert.deepEqual(rulesFor(componentPath, forbidden), ['positive-shadow', 'positive-shadow'])
})

test('normalizes vendor-prefixed arbitrary CSS properties', () => {
  const allowed = `
    export const Example = () => <div className="[-webkit-box-shadow:none] hover:[-webkit-box-shadow:_none] [masking-enabled:true]" />
  `
  const forbidden = `
    export const Example = () => <div className="[-webkit-box-shadow:0_1px_black] [-moz-mask-image:none]" />
  `

  assert.deepEqual(rulesFor(componentPath, allowed), [])
  assert.deepEqual(rulesFor(componentPath, forbidden), ['positive-shadow', 'mask'])
})

test('rejects CSS filter drop-shadow and positive text-shadow values', () => {
  const css = `
    .allowed { box-shadow: none; text-shadow: none; filter: none; }
    .raised { filter: drop-shadow(0 2px 2px rgb(0 0 0 / .2)); text-shadow: 0 1px 1px rgb(0 0 0 / .2); }
  `

  assert.deepEqual(
    rulesFor('frontend/cruip-landing/app/example.css', css),
    ['positive-shadow', 'positive-shadow'],
  )
})

test('rejects forbidden declarations in styled and css tagged templates', () => {
  const source = `
    const allowed = styled.div\`border-color: \${line}; color: var(--nothing-primary);\`
    const raised = styled.div\`box-shadow: \${depth}; mask-image: \${maskValue}; background: \${paint};\`
    const filtered = css\`text-shadow: 0 1px 1px rgb(0 0 0 / .2); filter: drop-shadow(0 2px 2px black);\`
    const dynamicFilter = css\`filter: \${filterValue};\`
  `

  const rules = rulesFor(componentPath, source)
  assert.equal(rules.filter((rule) => rule === 'positive-shadow').length, 4)
  assert.equal(rules.filter((rule) => rule === 'mask').length, 1)
  assert.equal(rules.filter((rule) => rule === 'gradient').length, 1)
})

test('resolves static tagged CSS interpolations without weakening sensitive contexts', () => {
  const allowed = `
    const flat = styled.div\`box-shadow: \${"none"}; filter: \${\`none\`}; background: \${"var(--nothing-surface)"}; border-color: \${line};\`
  `
  const forbidden = `
    const unknownProperty = css\`\${property}: \${value};\`
    const sensitive = css\`box-shadow: \${depth}; filter: \${filterValue}; background: \${paint};\`
  `

  assert.deepEqual(rulesFor(componentPath, allowed), [])
  const rules = rulesFor(componentPath, forbidden)
  assert.equal(rules.filter((rule) => rule === 'dynamic-css-property').length, 1)
  assert.equal(rules.filter((rule) => rule === 'positive-shadow').length, 2)
  assert.equal(rules.filter((rule) => rule === 'gradient').length, 1)
})

test('rejects vendor and case variants of mask style properties', () => {
  const source = `
    export const styles = {
      WebkitMaskImage: 'none',
      MozMaskImage: 'none',
      maskImage: 'none',
      mask: 'none',
      MASKIMAGE: 'none',
    }
  `
  const css = '.masked { -webkit-mask-image: none; -moz-mask-image: none; MASK: none; }'

  assert.equal(rulesFor(componentPath, source).filter((rule) => rule === 'mask').length, 5)
  assert.equal(
    rulesFor('frontend/cruip-landing/app/example.css', css).filter((rule) => rule === 'mask').length,
    3,
  )
})

test('handles shorthand CSS style keys without matching unrelated mask prefixes', () => {
  const forbidden = `
    const WebkitMaskImage = 'none'
    const WebkitBoxShadow = 'none'
    export const styles = { WebkitMaskImage, WebkitBoxShadow }
  `
  const allowed = `
    const maskingEnabled = true
    export const styles = { maskingEnabled, maskVersion: 2 }
    export const Example = () => <Widget maskingEnabled maskVersion={2} />
  `

  assert.deepEqual(rulesFor(componentPath, forbidden), ['mask', 'positive-shadow'])
  assert.deepEqual(rulesFor(componentPath, allowed), [])
})

test('rejects legacy brand tokens in CSS selectors', () => {
  const css = `
    .brand-primary-500, [data-tone='brand-accent-50'] { color: var(--nothing-primary); }
  `

  assert.equal(
    rulesFor('frontend/cruip-landing/app/example.css', css).filter(
      (rule) => rule === 'legacy-brand-token',
    ).length,
    2,
  )
})

test('rejects recognizable dynamic Tailwind forbidden fragments', () => {
  const source = `
    export const Forbidden = () => <div className={\`bg-\${kind}-to-r shadow-\${size} drop-shadow-\${depth} mask-\${mode} text-brand-\${tone}\`} />
    export const Allowed = () => <div className={\`grid-cols-\${columns} text-\${size}\`} />
  `

  const rules = rulesFor(componentPath, source)
  assert.equal(rules.filter((rule) => rule === 'gradient').length, 1)
  assert.equal(rules.filter((rule) => rule === 'positive-shadow').length, 2)
  assert.equal(rules.filter((rule) => rule === 'mask').length, 1)
  assert.equal(rules.filter((rule) => rule === 'legacy-brand-token').length, 1)
})

test('applies dynamic Tailwind detection after data and arbitrary variants', () => {
  const dataVariant = `
    export const Example = () => <div className={\`data-[state=open]:bg-\${kind}-to-r\`} />
  `
  const arbitraryVariant = `
    export const Example = () => <div className={\`[&>*]:bg-\${kind}-to-r\`} />
  `
  const otherForbidden = `
    export const Example = () => <div className={\`hover:shadow-\${size} group-[&>*]:mask-\${mode} sm:text-brand-\${tone}\`} />
  `
  const allowed = `
    export const Example = () => <div className={\`data-[state=open]:grid-cols-\${columns} [&>*]:text-\${size}\`} />
  `

  assert.deepEqual(rulesFor(componentPath, dataVariant), ['gradient'])
  assert.deepEqual(rulesFor(componentPath, arbitraryVariant), ['gradient'])

  const rules = rulesFor(componentPath, otherForbidden)
  assert.equal(rules.filter((rule) => rule === 'positive-shadow').length, 1)
  assert.equal(rules.filter((rule) => rule === 'mask').length, 1)
  assert.equal(rules.filter((rule) => rule === 'legacy-brand-token').length, 1)
  assert.deepEqual(rulesFor(componentPath, allowed), [])
})

test('rejects SVG gradient and mask elements', () => {
  const source = `
    export const Example = () => (
      <svg><linearGradient id="fade" /><motion.linearGradient id="moving" /><mask id="cutout" /></svg>
    )
  `

  assert.deepEqual(rulesFor(componentPath, source), ['gradient', 'gradient', 'mask'])
})

test('rejects JSX mask attributes', () => {
  const source = 'export const Example = () => <path mask="url(#cutout)" />'

  assert.deepEqual(rulesFor(componentPath, source), ['mask'])
})

test('exempts JSX anchor expression literals while rejecting raw hex elsewhere', () => {
  const source = `
    export const Example = () => (
      <><use href={"#abc"} xlinkHref={"#abcdef"} /><Widget dataColor={"#abc"} /></>
    )
  `

  assert.deepEqual(rulesFor(componentPath, source), ['raw-hex-color'])
})

test('exports and rejects every inventoried legacy brand token', () => {
  assert.deepEqual(LEGACY_BRAND_TOKENS, expectedLegacyBrandTokens)

  for (const token of expectedLegacyBrandTokens) {
    assert.ok(
      rulesFor(componentPath, `export const value = "${token}"`).includes('legacy-brand-token'),
      `${token} must be rejected`,
    )
  }
})

test('syntax errors fail closed for TypeScript and CSS', () => {
  assert.throws(() => scanSource({ relativePath: componentPath, source: 'export const = <div />' }))
  assert.throws(() => scanSource({ relativePath: basePath, source: '.broken {' }))
})

test('project scan includes only active source roots and supported extensions', async () => {
  await withFixture(async (repoRoot) => {
    await writeFile(
      path.join(repoRoot, 'frontend/cruip-landing/app/page.tsx'),
      'export default function Page() { return <div className="shadow-md" /> }',
    )
    await writeFile(path.join(repoRoot, 'frontend/cruip-landing/app/notes.md'), '# gradient')
    await mkdir(path.join(repoRoot, 'frontend/cruip-landing/lib'), { recursive: true })
    await writeFile(path.join(repoRoot, 'frontend/cruip-landing/lib/ignored.ts'), 'export const color = "#fff"')

    const violations = await scanUiContract({ repoRoot })

    assert.equal(violations.length, 1)
    assert.equal(violations[0].relativePath, 'frontend/cruip-landing/app/page.tsx')
    assert.equal(violations[0].rule, 'positive-shadow')
  })
})

test('read and walk errors reject instead of producing a passing result', async () => {
  await withFixture(async (repoRoot) => {
    await assert.rejects(scanFile(path.join(repoRoot, 'missing.tsx'), repoRoot))
    await rm(path.join(repoRoot, 'frontend/cruip-landing/components'), { recursive: true })
    await writeFile(path.join(repoRoot, 'frontend/cruip-landing/components'), 'not a directory')
    await assert.rejects(scanUiContract({ repoRoot }))
  })
})

test('project scan fails closed when the raw-hex token authority is missing', async () => {
  await withFixture(async (repoRoot) => {
    await rm(path.join(repoRoot, tokenPath))
    await assert.rejects(scanUiContract({ repoRoot }), /token authority/i)
  })
})

test('CLI exits non-zero when a violation is found', async () => {
  await withFixture(async (repoRoot) => {
    await writeFile(
      path.join(repoRoot, 'frontend/cruip-landing/components/example.tsx'),
      'export const Example = () => <div className="shadow-lg" />',
    )

    const result = spawnSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8' })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /positive-shadow/)
  })
})
