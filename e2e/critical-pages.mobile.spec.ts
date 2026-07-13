import { test, expect } from './fixtures'
import { PublicPage } from './pages/public-page'
import { SignInPage } from './pages/sign-in-page'
import { expectNoSeriousAccessibilityViolations } from './support/accessibility'

test('@healthy home mobile is accessible and visually stable', async ({ page }) => {
  const publicPage = new PublicPage(page)
  await publicPage.openHome('light')
  await expect(page.getByRole('heading', { level: 1, name: '安全存储，随时协作' })).toBeVisible()
  await expectNoSeriousAccessibilityViolations(page)
  await expect(page).toHaveScreenshot('home-mobile.png', { fullPage: true })
})

test('@healthy sign-in mobile is accessible and visually stable', async ({ page }) => {
  const signIn = new SignInPage(page)
  await signIn.open()
  await expect(page.getByLabel('邮箱')).toBeEditable()
  await expectNoSeriousAccessibilityViolations(page)
  await expect(page).toHaveScreenshot('sign-in-mobile.png', { fullPage: true })
})
