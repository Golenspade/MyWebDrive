import { expect, type Page } from '@playwright/test'

declare const page: Page

if (false) {
  // @ts-expect-error Playwright 1.61.1 does not support style on toHaveScreenshot
  void expect(page).toHaveScreenshot('invalid.png', { style: 'body {}' })
  void expect(page).toHaveScreenshot('valid.png', { stylePath: 'deterministic.css' })
}
