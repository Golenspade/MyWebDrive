"use client"

import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value?: string | number
  unit?: string
  delta?: number
  loading?: boolean
  error?: boolean
  className?: string
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  loading,
  error,
  className,
}: MetricCardProps) {
  const deltaText =
    delta !== undefined ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}%` : null

  return (
    <div
      className={cn(
        "min-w-0 rounded-[var(--nothing-r-md)] bg-nothing-glass p-5 text-nothing-primary backdrop-blur-[12px] transition-transform duration-200 ease-in-out hover:-translate-y-0.5",
        className
      )}
    >
      <div className="font-nothing-mono text-[10px] uppercase tracking-[0.1em] text-nothing-secondary">
        {label}
      </div>
      <div data-visual-dynamic className="mt-2 flex min-w-0 items-baseline gap-1.5 overflow-hidden">
        {loading ? (
          <span className="font-nothing-mono text-sm text-nothing-muted">
            [LOADING…]
          </span>
        ) : error ? (
          <span className="rounded-full bg-nothing-error/10 px-2 py-0.5 font-nothing-mono text-xs text-nothing-error">
            [ERROR]
          </span>
        ) : (
          <>
            <span
              className={cn(
                "min-w-0 truncate font-nothing-display text-4xl leading-none tracking-tight text-nothing-display",
                typeof value === "number" &&
                  (label.includes("错误") || label.includes("失败")) &&
                  value > 0 &&
                  "text-nothing-error"
              )}
            >
              {value ?? "-"}
            </span>
            {unit ? (
              <span className="shrink-0 font-nothing-mono text-sm text-nothing-secondary">
                {unit}
              </span>
            ) : null}
          </>
        )}
      </div>
      {deltaText ? (
        <div
          className={cn(
            "mt-1 font-nothing-mono text-[11px]",
            delta !== undefined && delta >= 0 ? "text-nothing-success" : "text-nothing-error"
          )}
        >
          {deltaText}
        </div>
      ) : null}
    </div>
  )
}
