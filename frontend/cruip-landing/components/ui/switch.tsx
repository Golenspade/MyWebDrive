"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    onCheckedChange?: (checked: boolean) => void
  }
>(({ className, onCheckedChange, onChange, ...props }, ref) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(event.target.checked)
    onChange?.(event)
  }

  return (
    <label
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-nothing-line-2 transition-colors duration-200 ease-in-out hover:opacity-80 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-30 has-[:focus-visible]:outline-[2px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--nothing-focus)]",
        className
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        onChange={handleChange}
        ref={ref}
        {...props}
      />
      <span className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-nothing-bg transition-transform duration-200 ease-in-out peer-checked:translate-x-[calc(100%-2px)] peer-checked:bg-nothing-bg" />
    </label>
  )
})
Switch.displayName = "Switch"

export { Switch }
