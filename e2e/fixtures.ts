import { test as base, expect } from '@playwright/test'

import { deterministicScreenshotStylePath } from './support/visual'

export const test = base.extend({})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.documentElement.style.setProperty('scroll-behavior', 'auto')
  })
})

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  const path = testInfo.outputPath('failure.png')
  await page.addStyleTag({ path: deterministicScreenshotStylePath })
  await page.screenshot({
    path,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    mask: [
      page.getByLabel('邮箱'),
      page.getByLabel('6 位验证码'),
      page.getByText(/验证码已发送至/),
    ],
    maskColor: '#000000',
  })
  await testInfo.attach('failure-screenshot', { path, contentType: 'image/png' })
})

export { expect }
