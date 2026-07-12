import type { DashboardRange, DashboardRangeKind } from './types.js'

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export class InvalidDashboardRangeError extends Error {
  constructor() {
    super('invalid dashboard range')
  }
}
function isDashboardRangeKind(value: unknown): value is DashboardRangeKind {
  return value === 'today' || value === '7d' || value === '30d'
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function parseDashboardRange(value: unknown, now: Date): DashboardRange {
  if (!isDashboardRangeKind(value) || !Number.isFinite(now.getTime())) {
    throw new InvalidDashboardRangeError()
  }

  const numberOfDates = value === 'today' ? 1 : value === '7d' ? 7 : 30
  const shanghaiNow = new Date(now.getTime() + SHANGHAI_OFFSET_MS)
  const currentLocalMidnight = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate(),
  )
  const firstLocalMidnight = currentLocalMidnight - (numberOfDates - 1) * DAY_MS
  const dates = Array.from({ length: numberOfDates }, (_, index) =>
    formatDate(firstLocalMidnight + index * DAY_MS),
  )

  return {
    kind: value,
    timezone: 'Asia/Shanghai',
    start: new Date(firstLocalMidnight - SHANGHAI_OFFSET_MS),
    end: now,
    dates,
  }
}
