import { test, expect } from './fixtures'
import { DashboardPage } from './pages/dashboard-page'
import { PublicPage } from './pages/public-page'
import { SignInPage } from './pages/sign-in-page'
import { expectNoSeriousAccessibilityViolations } from './support/accessibility'
import { requiredEnvironment, retryScopedEmail } from './support/environment'

test('@healthy home light is structured, accessible, and visually stable', async ({ page }) => {
  const publicPage = new PublicPage(page)
  await publicPage.openHome('light')
  await expect(page.getByRole('link', { name: /写下你的第一笔/ })).toBeVisible()
  await expectNoSeriousAccessibilityViolations(page)
  await expect(page).toHaveScreenshot('home-light.png', { fullPage: true })
})

test('@healthy home dark follows the visual contract', async ({ page }) => {
  const publicPage = new PublicPage(page)
  await publicPage.openHome('dark')
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  await expect(page).toHaveScreenshot('home-dark.png', { fullPage: true })
})

test('@healthy sign-in is structured, accessible, and visually stable', async ({ page }) => {
  const signIn = new SignInPage(page)
  await signIn.open()
  await expect(page.getByLabel('邮箱')).toBeEditable()
  await expectNoSeriousAccessibilityViolations(page)
  await expect(page).toHaveScreenshot('sign-in-light.png', { fullPage: true })
})

test('@healthy download catalog is usable, accessible, and visually stable', async ({ page }) => {
  const publicPage = new PublicPage(page)
  await publicPage.openDownload()
  await expect(page.getByText('下载凭证仅在点击时签发，且只能使用一次。')).toBeVisible()
  await expectNoSeriousAccessibilityViolations(page)
  await expect(page).toHaveScreenshot('download-light.png', { fullPage: true })
})

test('@healthy admin overview uses real OTP and renders both dashboard surfaces', async ({ page }, testInfo) => {
  const signIn = new SignInPage(page)
  await signIn.signInWithEmailOtp({
    email: retryScopedEmail(requiredEnvironment('E2E_ADMIN_EMAIL'), testInfo.retry),
    mailboxBaseUrl: requiredEnvironment('E2E_MAILBOX_BASE_URL'),
    mailboxToken: requiredEnvironment('E2E_MAILBOX_TOKEN'),
  })
  const dashboard = new DashboardPage(page)
  await dashboard.waitForHealthyData()
  await dashboard.selectToday()
  await expect(page.getByRole('heading', { level: 2, name: '业务分析' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '系统健康' })).toBeVisible()
  await expect(page.getByRole('button', { name: '全部刷新' })).toBeEnabled()
  await expectNoSeriousAccessibilityViolations(page)
  await dashboard.waitForStableRendering()
  await expect(page).toHaveScreenshot('admin-overview-dark.png', {
    fullPage: true,
    style: dashboard.dynamicVisualStyle(),
  })
})
