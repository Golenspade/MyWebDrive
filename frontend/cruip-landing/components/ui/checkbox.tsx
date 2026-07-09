"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid h-4 w-4 shrink-0 place-content-center rounded-[var(--nothing-r-sm)] border border-nothing-line-2 bg-nothing-surface text-nothing-bg outline-none transition-opacity duration-200 ease-in-out hover:border-nothing-primary focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[var(--nothing-focus)] disabled:pointer-events-none disabled:opacity-30 data-[state=checked]:bg-nothing-display data-[state=checked]:text-nothing-bg data-[state=checked]:border-nothing-display",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-current")}
    >
      <Check className="h-3.5 w-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
