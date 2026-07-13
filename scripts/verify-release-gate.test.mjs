import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('CI orders quality, six-image build, full smoke, then publication', async () => {
  const workflow = await read('.github/workflows/ci.yml')
  const quality = workflow.indexOf('name: Workspace quality gate')
  const build = workflow.indexOf('name: Build six release images')
  const smoke = workflow.indexOf('name: Full Core smoke and browser gate')
  const publish = workflow.indexOf('name: Publish immutable images')
  assert(quality >= 0 && quality < build && build < smoke && smoke < publish)
  assert.match(workflow, /SMOKE_REUSE_IMAGES:\s*["']?1/)
  assert.match(workflow, /SMOKE_BROWSER_GATE:\s*["']?1/)
  assert.doesNotMatch(workflow.slice(0, smoke), /docker push/)
})

test('Playwright is Chromium-only, deterministic, and never records credentials', async () => {
  const config = await read('playwright.config.ts')
  assert.match(config, /width:\s*1440,\s*height:\s*900/)
  assert.match(config, /width:\s*390,\s*height:\s*844/)
  assert.match(config, /forbidOnly:\s*!!process\.env\.CI/)
  assert.match(config, /trace:\s*'off'/)
  assert.match(config, /video:\s*'off'/)
  assert.match(config, /screenshot:\s*'off'/)
  assert.doesNotMatch(config, /firefox|webkit/i)

  const files = [
    'e2e/fixtures.ts',
    'e2e/pages/public-page.ts',
    'e2e/pages/sign-in-page.ts',
    'e2e/pages/dashboard-page.ts',
    'e2e/critical-pages.desktop.spec.ts',
    'e2e/critical-pages.mobile.spec.ts',
    'e2e/dashboard-degraded.desktop.spec.ts',
  ]
  for (const file of files) {
    const source = await read(file)
    assert.doesNotMatch(source, /waitForTimeout\s*\(|\.first\s*\(|\.nth\s*\(/, file)
  }

  const dashboardPage = await read('e2e/pages/dashboard-page.ts')
  assert.match(dashboardPage, /\[data-visual-dynamic\].*visibility: hidden/)
})

test('visual authority contains the seven required Linux Chromium baselines', async () => {
  const snapshots = (await readdir(new URL('../e2e/snapshots/', import.meta.url))).sort()
  assert.deepEqual(snapshots, [
    'admin-overview-dark-chromium-desktop-linux.png',
    'download-light-chromium-desktop-linux.png',
    'home-dark-chromium-desktop-linux.png',
    'home-light-chromium-desktop-linux.png',
    'home-mobile-chromium-mobile-linux.png',
    'sign-in-light-chromium-desktop-linux.png',
    'sign-in-mobile-chromium-mobile-linux.png',
  ])
})

test('browser documentation requires explicit Linux snapshot updates', async () => {
  const docs = await read('docs/manage-services.md')
  assert.match(docs, /Committed snapshots .* are Linux-authoritative/)
  assert.match(docs, /SMOKE_UPDATE_SNAPSHOTS=1/)
  assert.match(docs, /Do not generate authoritative snapshots on macOS/)
})

test('smoke runs healthy browser checks before Prometheus degradation and degraded checks before recovery', async () => {
  const smoke = await read('scripts/smoke-core-e2e.sh')
  const healthy = smoke.indexOf('run_browser_gate healthy')
  const stop = smoke.indexOf('compose stop prometheus')
  const degraded = smoke.indexOf('run_browser_gate prometheus-down')
  const recovery = smoke.indexOf('compose up -d --wait --no-deps prometheus', degraded)
  assert(healthy >= 0 && healthy < stop && stop < degraded && degraded < recovery)
})
