import { test as base, expect } from '@playwright/test'

export const test = base.extend({})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.documentElement.style.setProperty('scroll-behavior', 'auto')
  })
})

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  const path = testInfo.outputPath('failure.png')
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
    style: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  })
  await testInfo.attach('failure-screenshot', { path, contentType: 'image/png' })
})

export { expect }
