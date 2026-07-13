import { test, expect } from './fixtures'
import { DashboardPage } from './pages/dashboard-page'
import { SignInPage } from './pages/sign-in-page'
import { requiredEnvironment, retryScopedEmail } from './support/environment'

test('@degraded Prometheus failure stays isolated and the dashboard remains operable', async ({ page }, testInfo) => {
  const signIn = new SignInPage(page)
  await signIn.signInWithEmailOtp({
    email: retryScopedEmail(requiredEnvironment('E2E_ADMIN_EMAIL'), testInfo.retry),
    mailboxBaseUrl: requiredEnvironment('E2E_MAILBOX_BASE_URL'),
    mailboxToken: requiredEnvironment('E2E_MAILBOX_TOKEN'),
  })
  const dashboard = new DashboardPage(page)
  await dashboard.waitForPrometheusDegradation()
  await dashboard.selectToday()
  await expect(page.getByText(/数据覆盖：上传自 (?!不可用)/)).toBeVisible()
  await expect(page.getByRole('button', { name: '全部刷新' })).toBeEnabled()
  await expect(page.getByText(/Prometheus 状态：partial/)).toBeVisible()
})
