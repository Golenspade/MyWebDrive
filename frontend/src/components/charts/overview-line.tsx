import React from 'react'

export type SeriesPoint = { date: string; value: number }

interface OverviewLineProps {
  data: SeriesPoint[]
  className?: string
}

// Lightweight SVG line chart (no external deps)
export default function OverviewLine({ data, className }: OverviewLineProps) {
  const width = 640
  const height = 300
  const padding = { top: 16, right: 16, bottom: 30, left: 40 }

  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = data.map((d) => d.value)
  const minY = Math.min(0, ...values)
  const maxY = Math.max(1, ...values)

  const x = (i: number) => (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => innerH - ((v - minY) / (maxY - minY || 1)) * innerH

  const pathD = React.useMemo(() => {
    if (!data.length) return ''
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(d.value).toFixed(2)}`)
      .join(' ')
  }, [data])

  const yTicks = 4
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => minY + ((maxY - minY) * i) / yTicks)

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="trend chart">
        {/* axes */}
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* grid & y axis ticks */}
          {tickVals.map((tv, i) => (
            <g key={i}>
              <line
                x1={0}
                x2={innerW}
                y1={y(tv)}
                y2={y(tv)}
                stroke="hsl(var(--muted))"
                strokeOpacity={0.3}
              />
              <text x={-8} y={y(tv)} dy="0.32em" textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">
                {formatNumber(tv)}
              </text>
            </g>
          ))}

          {/* x labels (first & last date) */}
          {data.length > 0 && (
            <>
              <text x={0} y={innerH + 18} fontSize="10" fill="hsl(var(--muted-foreground))">
                {data[0].date}
              </text>
              <text x={innerW} y={innerH + 18} fontSize="10" textAnchor="end" fill="hsl(var(--muted-foreground))">
                {data[data.length - 1].date}
              </text>
            </>
          )}

          {/* area under line (subtle) */}
          {pathD && (
            <path
              d={`${pathD} L ${innerW} ${innerH} L 0 ${innerH} Z`}
              fill="hsl(var(--primary))"
              fillOpacity={0.08}
              stroke="none"
            />
          )}

          {/* line path */}
          {pathD && (
            <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* points */}
          {data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.value)} r={2}
              fill="hsl(var(--primary))" />
          ))}
        </g>
      </svg>
    </div>
  )
}

function formatNumber(n: number) {
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e12) return (n / 1e12).toFixed(1) + 'T'
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.round(n))
}

