"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-[var(--nothing-r-md)] border-l-[3px] p-4 font-nothing-ui text-sm transition-opacity duration-200 ease-in-out",
  {
    variants: {
      variant: {
        info: "border-l-nothing-line-2 bg-nothing-surface text-nothing-primary",
        success: "border-l-nothing-success bg-nothing-success/9 text-nothing-primary",
        warning: "border-l-nothing-warning bg-nothing-warning/9 text-nothing-primary",
        error: "border-l-nothing-error bg-nothing-error/9 text-nothing-primary",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
)

const iconVariants = cva("absolute top-4 left-4 size-4", {
  variants: {
    variant: {
      info: "text-nothing-secondary",
      success: "text-nothing-success",
      warning: "text-nothing-warning",
      error: "text-nothing-error",
    },
  },
  defaultVariants: {
    variant: "info",
  },
})

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant = "info", children, ...props }, ref) => {
  const Icon = icons[variant ?? "info"]
  const role = variant === "error" ? "alert" : "status"

  return (
    <div
      ref={ref}
      role={role}
      className={cn(alertVariants({ variant }), "pl-10", className)}
      {...props}
    >
      <Icon className={cn(iconVariants({ variant }))} aria-hidden="true" />
      {children}
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      "mb-1 font-nothing-mono text-[11px] font-medium uppercase tracking-[0.08em] text-nothing-display",
      className
    )}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-nothing-secondary", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
