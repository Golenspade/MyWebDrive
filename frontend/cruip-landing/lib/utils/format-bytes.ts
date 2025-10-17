// Compact bytes formatter limited to KB/MB/GB/PB with auto unit escalation
// Rule: default from KB; if integer digits exceed 5, escalate to next unit
// Examples: 12.3 MB, 99999 KB -> 97.66 MB

export function formatCompactBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'] as const
  let val = bytes / 1024 // start with KB
  let unit = 0
  // escalate while integer digits exceed 5 and we have higher unit
  while (unit < units.length - 1) {
    const intDigits = Math.floor(Math.abs(val)).toString().length
    if (intDigits <= 5) break
    val = val / 1024
    unit++
  }
  // choose decimals: keep up to 2 decimals for small numbers
  const decimals = val >= 100 ? 0 : val >= 10 ? 1 : 2
  return `${val.toFixed(decimals)} ${units[unit]}`
}

