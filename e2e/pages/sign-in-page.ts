import type { Page } from '@playwright/test'

import { readLatestMailbox } from '../support/mailbox.mjs'

export class SignInPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.addInitScript(() => window.localStorage.setItem('theme', 'light'))
    await this.page.goto('/signin')
    await this.page.getByRole('heading', { level: 1, name: '使用邮箱登录' }).waitFor()
    await this.page.evaluate(async () => {
      await document.fonts.ready
    })
  }

  async signInWithEmailOtp(input: {
    email: string
    mailboxBaseUrl: string
    mailboxToken: string
  }) {
    await this.open()
    await this.page.getByLabel('邮箱').fill(input.email)
    await this.page.getByRole('button', { name: '发送验证码' }).click()
    await this.page.getByRole('heading', { level: 1, name: '输入验证码' }).waitFor()
    const message = await readLatestMailbox({
      baseUrl: input.mailboxBaseUrl,
      recipient: input.email,
      token: input.mailboxToken,
    })
    await this.page.getByLabel('6 位验证码').fill(message.code)
    await this.page.getByRole('button', { name: '验证并登录' }).click()
    await this.page.waitForURL(/\/admin\/overview$/)
  }
}
