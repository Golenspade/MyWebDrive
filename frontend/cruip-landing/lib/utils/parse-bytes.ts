// Parse human-readable size strings like "500", "500 MB", "1.5GB", "200kb"
// Returns bytes as number (floored). Supports KB/MB/GB/TB/PB (case-insensitive). Defaults to bytes when no unit.
export function parseBytes(input: string): number {
  if (!input) return 0
  const s = String(input).trim()
  if (!s) return 0
  const m = s.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*([kKmMgGtTpP]?[bB])?\s*$/)
  if (!m) return Number.isFinite(Number(s)) ? Math.floor(Number(s)) : 0
  const val = Number(m[1])
  const unit = (m[2] || '').toLowerCase()
  const K = 1024
  if (!unit || unit === 'b') return Math.floor(val)
  if (unit === 'kb') return Math.floor(val * K)
  if (unit === 'mb') return Math.floor(val * K * K)
  if (unit === 'gb') return Math.floor(val * K * K * K)
  if (unit === 'tb') return Math.floor(val * K * K * K * K)
  if (unit === 'pb') return Math.floor(val * K * K * K * K * K)
  return Math.floor(val)
}

// Format a number of bytes into specific unit string using integer rounding (for slider labels)
export function toUnit(bytes: number, unit: 'KB'|'MB'|'GB'|'TB'|'PB'): number {
  const K = 1024
  if (unit === 'KB') return Math.floor(bytes / K)
  if (unit === 'MB') return Math.floor(bytes / (K*K))
  if (unit === 'GB') return Math.floor(bytes / (K*K*K))
  if (unit === 'TB') return Math.floor(bytes / (K*K*K*K))
  if (unit === 'PB') return Math.floor(bytes / (K*K*K*K*K))
  return bytes
}

