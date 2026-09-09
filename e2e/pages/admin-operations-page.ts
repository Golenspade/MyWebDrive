import { expect, type Page, type Response } from '@playwright/test'

export class AdminOperationsPage {
  private readonly responses = new Map<string, Response>()

  constructor(private readonly page: Page) {
    page.on('response', response => {
      const pathname = new URL(response.url()).pathname
      if (pathname === '/api/v1/admin/users' || pathname === '/api/v1/admin/notifications') {
        this.responses.set(pathname, response)
      }
    })
  }

  async openUsers(expectedEmail: string) {
    await this.page.goto('/admin/users')
    await expect(this.page.getByRole('heading', { level: 1, name: '用户管理' })).toBeVisible()
    await expect(this.page.getByRole('button', { name: '按池自动分配' })).toBeVisible()
    await expect(
      this.page.getByRole('table', { name: '用户列表' }).getByRole('cell', { name: expectedEmail, exact: true }),
    ).toBeVisible()
    await expect.poll(() => this.responses.get('/api/v1/admin/users')?.status()).toBe(200)
  }

  async openStorage(expectedEmail: string) {
    await this.page.goto('/admin/storage')
    await expect(this.page.getByRole('heading', { level: 1, name: '存储面板' })).toBeVisible()
    await expect(this.page.getByRole('cell', { name: expectedEmail })).toBeVisible()
    await expect(this.page.getByText('Request failed')).toHaveCount(0)
    await expect.poll(() => this.responses.get('/api/v1/admin/users')?.status()).toBe(200)
  }

  async openNotifications() {
    await this.page.goto('/admin/notifications')
    await expect(this.page.getByRole('heading', { level: 2, name: '通知中心' })).toBeVisible()
    await expect(this.page.getByText('Request failed')).toHaveCount(0)
    await expect(this.page.getByText(/共\s*0\s*条/)).toBeVisible()
    await expect.poll(() => this.responses.get('/api/v1/admin/notifications')?.status()).toBe(200)
  }
}
