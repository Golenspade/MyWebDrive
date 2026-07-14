import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')
const execFileAsync = promisify(execFile)

test('CI orders quality, six-image build, full smoke, then publication', async () => {
  const workflow = await read('.github/workflows/ci.yml')
  const install = workflow.indexOf('name: Install locked dependencies')
  const migration = workflow.indexOf('name: Apply Core migrations')
  const chromium = workflow.indexOf('name: Install Chromium runtime')
  const quality = workflow.indexOf('name: Workspace quality gate')
  const build = workflow.indexOf('name: Build six release images')
  const smoke = workflow.indexOf('name: Full Core smoke and browser gate')
  const publish = workflow.indexOf('name: Publish immutable images')
  assert(install >= 0 && install < migration && migration < quality)
  assert(chromium >= 0 && chromium < quality)
  assert(quality >= 0 && quality < build && build < smoke && smoke < publish)
  assert.match(workflow, /CORE_DATABASE_URL: postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/mywebdrive_core_test\?schema=public/)
  assert.match(workflow.slice(migration, quality), /run: pnpm --filter core-api exec prisma migrate deploy/)
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
  assert.match(config, /\['json',\s*\{\s*outputFile:/)
  assert.doesNotMatch(config, /\['html'/)

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
  assert.doesNotMatch(dashboardPage, /dynamicVisualStyle/)
  const desktop = await read('e2e/critical-pages.desktop.spec.ts')
  assert.match(desktop, /stylePath:\s*deterministicScreenshotStylePath/)
  assert.match(desktop, /addStyleTag\(\{\s*path:\s*deterministicScreenshotStylePath\s*\}\)/)
  assert.doesNotMatch(desktop, /\bstyle:/)
  const deterministicCss = await read('e2e/styles/deterministic-screenshot.css')
  assert.match(deterministicCss, /\[data-visual-dynamic\][^{]*\{[^}]*visibility:\s*hidden\s*!important/)
})

test('root typecheck includes Playwright config, specs, page objects, and fixtures', async () => {
  const packageJson = JSON.parse(await read('package.json'))
  assert.equal(packageJson.devDependencies['@types/node'], '22.18.6')
  assert.equal(packageJson.scripts['typecheck:e2e'], 'tsc -p tsconfig.e2e.json --noEmit --pretty false')
  assert.match(packageJson.scripts.typecheck, /pnpm run typecheck:e2e/)
  const tsconfig = JSON.parse(await read('tsconfig.e2e.json'))
  assert.deepEqual(tsconfig.include, ['playwright.config.ts', 'e2e/**/*.ts'])
  const optionContract = await read('e2e/support/playwright-options.contract.ts')
  assert.match(optionContract, /@ts-expect-error Playwright 1\.61\.1 does not support style/)
  assert.match(optionContract, /stylePath:/)
})

test('active frontend declares its explicit TypeScript ESLint runtime directly', async () => {
  const eslintConfig = JSON.parse(await read('frontend/.eslintrc.json'))
  const frontendPackage = JSON.parse(await read('frontend/cruip-landing/package.json'))

  assert.equal(eslintConfig.parser, '@typescript-eslint/parser')
  assert(eslintConfig.plugins.includes('@typescript-eslint'))
  assert(eslintConfig.plugins.includes('react-hooks'))
  assert(eslintConfig.overrides.some((override) =>
    override.extends?.includes('plugin:@typescript-eslint/recommended')))
  assert.equal(frontendPackage.devDependencies['@typescript-eslint/eslint-plugin'], '8.47.0')
  assert.equal(frontendPackage.devDependencies['@typescript-eslint/parser'], '8.47.0')
  assert.equal(frontendPackage.devDependencies['eslint-plugin-react-hooks'], '7.0.1')
})

test('release gate persists structured report, cleanup, and entrypoint contracts', async () => {
  const packageJson = JSON.parse(await read('package.json'))
  assert.match(packageJson.scripts['test:release-gate'], /smoke-core-artifacts\.test\.sh/)
  const smoke = await read('scripts/smoke-core-e2e.sh')
  assert.match(smoke, /source .*smoke-core-artifacts\.sh/)
  assert.match(smoke, /trap - EXIT INT TERM ERR/)
  const mode = await read('scripts/smoke-core-mode.sh')
  assert.match(mode, /--entrypoint sh/)
  assert.match(mode, /--entrypoint corepack/)
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
  const health = await read('scripts/smoke-core-health.sh')
  assert.match(health, /value\.availability !== expected/)
  assert.match(smoke, /smoke_wait_for_exact_availability available/)
  assert.match(smoke, /core smoke browser command: playwright test --grep/)
  const healthy = smoke.indexOf('run_browser_gate healthy')
  const stop = smoke.indexOf('compose stop prometheus')
  const degraded = smoke.indexOf('run_browser_gate prometheus-down')
  const recovery = smoke.indexOf('compose up -d --wait --no-deps prometheus', degraded)
  const recovered = smoke.indexOf('System Health did not recover to available', recovery)
  assert(healthy >= 0 && healthy < stop && stop < degraded && degraded < recovery && recovery < recovered)
  assert.doesNotMatch(smoke, /\["available","partial"\]\.includes/)
})

test('Redis and MinIO recovery wait for running storage services without re-up fail-fast', async () => {
  const smoke = await read('scripts/smoke-core-e2e.sh')
  const postgresStop = smoke.indexOf('compose stop postgres')
  const redisStop = smoke.indexOf('compose stop redis', postgresStop)
  const minioStop = smoke.indexOf('compose stop minio', redisStop)
  const recoveryEnd = smoke.indexOf('compose logs --no-color', minioStop)
  assert(postgresStop >= 0 && postgresStop < redisStop && redisStop < minioStop && minioStop < recoveryEnd)

  const postgresRecovery = smoke.slice(postgresStop, redisStop)
  assert.match(postgresRecovery, /compose start postgres[\s\S]*compose up -d --wait --no-deps postgres[\s\S]*compose up -d --wait --no-deps core-api/)

  const redisRecovery = smoke.slice(redisStop, minioStop)
  const redisStart = redisRecovery.indexOf('compose start redis')
  const redisHealthy = redisRecovery.indexOf('compose up -d --wait --no-deps redis', redisStart)
  const redisCoreReady = redisRecovery.indexOf('wait_ready_status core-api http://127.0.0.1:8080/ready 200', redisHealthy)
  const redisStorageReady = redisRecovery.indexOf('wait_ready_status storage-api http://127.0.0.1:7084/ready 200', redisCoreReady)
  const redisWorkerReady = redisRecovery.indexOf('wait_ready_status storage-worker http://127.0.0.1:7085/ready 200', redisStorageReady)
  assert(redisStart >= 0 && redisStart < redisHealthy && redisHealthy < redisCoreReady)
  assert(redisCoreReady < redisStorageReady && redisStorageReady < redisWorkerReady)
  assert.doesNotMatch(redisRecovery, /compose up[^\n]*(?:core-api|storage-api|storage-worker)/)

  const minioRecovery = smoke.slice(minioStop, recoveryEnd)
  const minioStart = minioRecovery.indexOf('compose start minio')
  const minioHealthy = minioRecovery.indexOf('compose up -d --wait --no-deps minio', minioStart)
  const minioInit = minioRecovery.indexOf('compose run --rm --no-deps minio-init', minioHealthy)
  const minioStorageReady = minioRecovery.indexOf('wait_ready_status storage-api http://127.0.0.1:7084/ready 200', minioInit)
  const minioWorkerReady = minioRecovery.indexOf('wait_ready_status storage-worker http://127.0.0.1:7085/ready 200', minioStorageReady)
  assert(minioStart >= 0 && minioStart < minioHealthy && minioHealthy < minioInit)
  assert(minioInit < minioStorageReady && minioStorageReady < minioWorkerReady)
  assert.doesNotMatch(minioRecovery, /compose up[^\n]*(?:core-api|storage-api|storage-worker)/)
})

test('failure artifact workflow passes the directory directly to the real package script', async () => {
  const workflow = await read('.github/workflows/ci.yml')
  const artifactStep = workflow.slice(
    workflow.indexOf('name: Verify sanitized failure artifacts'),
    workflow.indexOf('name: Upload sanitized failure artifacts'),
  )
  assert.match(artifactStep, /pnpm run verify:smoke-artifacts "\$SMOKE_ARTIFACT_DIR"/)
  assert.doesNotMatch(artifactStep, /verify:smoke-artifacts\s+--/)

  const artifactDirectory = await mkdtemp(join(tmpdir(), 'mywebdrive-safe-smoke-artifacts-'))
  try {
    const { stdout } = await execFileAsync(
      'pnpm',
      ['run', 'verify:smoke-artifacts', artifactDirectory],
      { cwd: new URL('../', import.meta.url) },
    )
    assert.match(stdout, /smoke artifacts: safe/)
  } finally {
    await rm(artifactDirectory, { recursive: true, force: true })
  }
})

test('snapshot update documentation requires verified Linux container provenance', async () => {
  const docs = await read('docs/manage-services.md')
  assert.match(docs, /exactly `1`/)
  assert.match(docs, /actual Linux platform/)
  assert.match(docs, /Playwright `1\.61\.1`/)
  assert.match(docs, /launch Chromium/)
  assert.match(docs, /project name.*not.*provenance/i)
  const mode = await read('scripts/smoke-core-mode.sh')
  assert.match(mode, /process\.platform/)
  assert.match(mode, /@playwright\/test\/package\.json.*1\.61\.1/s)
  assert.match(mode, /chromium\.launch/)
})
