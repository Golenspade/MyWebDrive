import * as React from "react"

import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[var(--nothing-r-sm)] border border-nothing-line-2 bg-nothing-surface px-3 py-2 text-sm font-nothing-ui text-nothing-primary outline-none transition-colors duration-200 ease-in-out placeholder:text-nothing-muted hover:border-nothing-primary focus-visible:border-nothing-primary focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[var(--nothing-focus)] disabled:pointer-events-none disabled:opacity-30",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
