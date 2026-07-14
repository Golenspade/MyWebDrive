import type { Page } from '@playwright/test'

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async waitForHealthyData() {
    await this.page.getByRole('heading', { level: 1, name: '系统概览' }).waitFor()
    await this.page.getByText(/Prometheus 状态：available/).waitFor()
    await this.page.getByText(/读模型更新：(?!不可用)/).waitFor()
  }

  async waitForPrometheusDegradation() {
    await this.page.getByRole('heading', { level: 1, name: '系统概览' }).waitFor()
    await this.page.getByText(/Prometheus 状态：partial/).waitFor()
    await this.page.getByText(/读模型更新：(?!不可用)/).waitFor()
  }

  async selectToday() {
    await this.page.getByRole('button', { name: '今天', exact: true }).click()
    await this.page.getByText('业务分析与系统健康独立加载 · 今天').waitFor()
    await this.page.getByText(/读模型更新：(?!不可用)/).waitFor()
  }

  async waitForStableRendering() {
    await this.page.evaluate(async () => {
      await document.fonts.ready
    })
  }
}
