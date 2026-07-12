const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const

export function formatDashboardBytes(value: string | null): { value: string; unit: string } {
  if (value == null) return { value: '-', unit: '' }

  let bytes: bigint
  try {
    bytes = BigInt(value)
  } catch {
    return { value: '-', unit: '' }
  }

  const zero = BigInt(0)
  const one = BigInt(1)
  const hundred = BigInt(100)
  const base = BigInt(1024)
  const negative = bytes < zero
  const magnitude = negative ? -bytes : bytes
  let unitIndex = 0
  let divisor = one
  while (unitIndex < BYTE_UNITS.length - 1 && magnitude >= divisor * base) {
    divisor *= base
    unitIndex += 1
  }

  const hundredths = (magnitude * hundred + divisor / BigInt(2)) / divisor
  const whole = hundredths / hundred
  const fraction = (hundredths % hundred).toString().padStart(2, '0')
  return {
    value: `${negative ? '-' : ''}${whole}.${fraction}`,
    unit: BYTE_UNITS[unitIndex],
  }
}

export function formatDashboardInteger(value: string | null): string {
  if (value == null) return '-'
  try {
    return BigInt(value).toLocaleString('zh-CN')
  } catch {
    return '-'
  }
}

export function decimalStringToChartNumber(value: string | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
