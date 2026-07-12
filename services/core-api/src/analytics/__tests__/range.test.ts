import { describe, expect, test } from 'vitest'

import {
  InvalidDashboardRangeError,
  parseDashboardRange,
} from '../range.js'

const now = new Date('2026-07-12T12:00:00.000Z')

describe('parseDashboardRange', () => {
  test('uses the current Shanghai calendar day for today', () => {
    expect(parseDashboardRange('today', now)).toEqual({
      kind: 'today',
      timezone: 'Asia/Shanghai',
      start: new Date('2026-07-11T16:00:00.000Z'),
      end: now,
      dates: ['2026-07-12'],
    })
  })

  test('uses seven inclusive Shanghai calendar dates for 7d', () => {
    const range = parseDashboardRange('7d', now)

    expect(range.start.toISOString()).toBe('2026-07-05T16:00:00.000Z')
    expect(range.end).toBe(now)
    expect(range.dates).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ])
  })

  test('uses thirty inclusive Shanghai calendar dates for 30d', () => {
    const range = parseDashboardRange('30d', now)

    expect(range.start.toISOString()).toBe('2026-06-12T16:00:00.000Z')
    expect(range.dates).toHaveLength(30)
    expect(range.dates.at(0)).toBe('2026-06-13')
    expect(range.dates.at(-1)).toBe('2026-07-12')
  })

  test('crosses month boundaries without using the host timezone', () => {
    const range = parseDashboardRange('7d', new Date('2026-03-02T12:00:00.000Z'))

    expect(range.start.toISOString()).toBe('2026-02-23T16:00:00.000Z')
    expect(range.dates).toEqual([
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  test.each([undefined, null, '', 'yesterday', '31d', ['7d']])(
    'rejects unsupported range %s',
    (value) => {
      expect(() => parseDashboardRange(value, now)).toThrow(InvalidDashboardRangeError)
    },
  )
})
