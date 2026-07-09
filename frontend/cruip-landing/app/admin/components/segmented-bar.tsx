"use client"

import { cn } from "@/lib/utils"

interface SegmentedBarProps {
  used: number
  limit: number
  className?: string
}

export function SegmentedBar({ used, limit, className }: SegmentedBarProps) {
  const cap = 20
  const ratio = limit > 0 ? used / limit : 0
  const filled = Math.min(cap, Math.max(0, Math.round(ratio * cap)))
  const overLimit = used > limit && limit > 0
  const displayLimit = Math.max(0, limit)
  const displayUsed = Math.max(0, used)

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex gap-0.5">
        {Array.from({ length: cap }).map((_, i) => {
          const isFilled = i < filled
          return (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-none",
                isFilled
                  ? overLimit
                    ? "bg-nothing-accent"
                    : "bg-nothing-display"
                  : "bg-nothing-line"
              )}
            />
          )
        })}
      </div>
      <div className="font-nothing-display text-sm text-nothing-display">
        {displayUsed}
      </div>
      <span className="font-nothing-mono text-xs text-nothing-secondary">/</span>
      <div className="font-nothing-display text-sm text-nothing-secondary">
        {displayLimit}
      </div>
    </div>
  )
}
