import { defineConfig } from '@playwright/test'

const outputDir = process.env.E2E_OUTPUT_DIR ?? 'test-results'
const reportDir = process.env.E2E_REPORT_DIR ?? 'playwright-report'

export default defineConfig({
  testDir: './e2e',
  outputDir,
  snapshotPathTemplate: '{testDir}/snapshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: [
    ['line'],
    ['html', { outputFolder: reportDir, open: 'never' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium-desktop-linux',
      testMatch: '**/*.desktop.spec.ts',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-mobile-linux',
      testMatch: '**/*.mobile.spec.ts',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
