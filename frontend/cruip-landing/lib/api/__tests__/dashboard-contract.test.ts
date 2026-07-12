import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const root = resolve(__dirname, '../../../../..')
const readOptional = (path: string) => {
  const absolute = resolve(root, path)
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : ''
}

describe('Admin Dashboard split data contract', () => {
  test('uses independent Business Analytics and System Health endpoints', () => {
    const source = readOptional('frontend/cruip-landing/lib/api/dashboard.ts')

    expect(source).toContain("export type DashboardRangeKind = 'today' | '7d' | '30d'")
    expect(source).toContain('/admin/dashboard/business?range=${range}')
    expect(source).toContain('/admin/dashboard/system?range=${range}')
    expect(source).toMatch(/committedStorageBytes:\s*string/)
    expect(source).toMatch(/requestsCount:\s*string \| null/)
    expect(source).not.toContain('/admin/overview')
    expect(source).not.toContain('last7d')
  })

  test('keeps the two resources independent and range-aware', () => {
    const page = readOptional('frontend/cruip-landing/app/admin/overview/page.tsx')

    expect(page).toContain('Promise.allSettled')
    expect(page).toContain('businessState')
    expect(page).toContain('systemState')
    expect(page).toContain('rangeLabel')
    expect(page).toContain('数据覆盖')
    expect(page).toContain('AbortController')
    expect(page).toContain('businessController?.signal')
    expect(page).toContain('systemController?.signal')
    expect(page).not.toContain('AdminOverview')
    expect(page).not.toContain('last7d')
  })

  test('removes the obsolete monolithic client', () => {
    expect(existsSync(resolve(root, 'frontend/cruip-landing/lib/api/overview.ts'))).toBe(false)
  })

  test('preserves stale data when a refresh fails', async () => {
    let resource: typeof import('../../dashboard/resource-state') | undefined
    try {
      resource = await import('../../dashboard/resource-state')
    } catch {
      resource = undefined
    }
    expect(resource).toBeDefined()
    if (!resource) return

    const previous = resource.readyResource({ value: 7 }, '2026-07-12T12:00:00.000Z')
    const next = resource.rejectedResource(previous, new Error('metrics unavailable'))

    expect(next).toEqual({
      status: 'stale',
      data: { value: 7 },
      error: 'metrics unavailable',
      updatedAt: '2026-07-12T12:00:00.000Z',
    })
    expect(resource.rejectedResource(resource.emptyResource(), new Error('offline'))).toMatchObject({
      status: 'unavailable',
      data: null,
      error: 'offline',
    })
  })

  test('formats decimal byte strings without Number precision loss', async () => {
    let formatter: typeof import('../../dashboard/format') | undefined
    try {
      formatter = await import('../../dashboard/format')
    } catch {
      formatter = undefined
    }
    expect(formatter).toBeDefined()
    if (!formatter) return

    expect(formatter.formatDashboardBytes('1024')).toEqual({ value: '1.00', unit: 'KB' })
    expect(formatter.formatDashboardBytes('9007199254740993')).toEqual({
      value: '8.00',
      unit: 'PB',
    })
    expect(formatter.formatDashboardBytes(null)).toEqual({ value: '-', unit: '' })
  })
})
