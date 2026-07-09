import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--nothing-r-sm)] font-nothing-mono text-xs font-medium uppercase tracking-[0.06em] transition-opacity duration-200 ease-in-out disabled:pointer-events-none disabled:opacity-30 outline-none focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[var(--nothing-focus)] aria-invalid:outline-[var(--nothing-error)] aria-invalid:outline-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-nothing-display text-nothing-bg hover:opacity-80 active:opacity-60",
        destructive:
          "border border-nothing-line-2 bg-transparent text-nothing-error hover:opacity-80 active:opacity-60",
        outline:
          "border border-nothing-line-2 bg-transparent text-nothing-primary hover:opacity-80 active:opacity-60",
        secondary:
          "bg-transparent text-nothing-primary hover:opacity-80 active:opacity-60",
        ghost:
          "bg-transparent text-nothing-primary hover:opacity-80 active:opacity-60",
        link:
          "bg-transparent text-nothing-primary underline-offset-4 hover:underline",
        icon:
          "size-[38px] rounded-full bg-nothing-display text-nothing-bg hover:opacity-80 active:opacity-60 p-0",
        square:
          "size-[38px] rounded-[var(--nothing-r-sm)] bg-nothing-display text-nothing-bg hover:opacity-80 active:opacity-60 p-0",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 gap-1.5 px-3 text-[11px]",
        lg: "h-10 px-6",
        icon: "size-[38px]",
        square: "size-[38px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  // Note: this file intentionally only exports React components (Button,
  // buttonVariants) so that React Fast Refresh can work reliably.
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
