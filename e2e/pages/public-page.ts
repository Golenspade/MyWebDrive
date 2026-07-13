import type { Page } from '@playwright/test'

export class PublicPage {
  constructor(private readonly page: Page) {}

  async openHome(theme: 'light' | 'dark' = 'light') {
    await this.setTheme(theme)
    await this.page.goto('/')
    await this.page.getByRole('heading', { level: 1, name: '安全存储，随时协作' }).waitFor()
    await this.waitForStableRendering()
  }

  async openDownload() {
    await this.setTheme('light')
    await this.page.goto('/download')
    await this.page.getByRole('heading', { level: 1, name: '软件分发' }).waitFor()
    await this.waitForStableRendering()
  }

  private async setTheme(theme: 'light' | 'dark') {
    await this.page.addInitScript((selectedTheme) => {
      window.localStorage.setItem('theme', selectedTheme)
    }, theme)
  }

  async waitForStableRendering() {
    await this.page.evaluate(async () => {
      await document.fonts.ready
    })
  }
}
