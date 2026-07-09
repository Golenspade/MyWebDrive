"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[var(--nothing-r-sm)] border border-nothing-line-2 bg-nothing-surface px-3 py-2 text-sm text-nothing-primary font-nothing-ui outline-none transition-colors duration-200 ease-in-out placeholder:text-nothing-muted hover:border-nothing-primary focus-visible:border-nothing-primary focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[var(--nothing-focus)] disabled:opacity-30 disabled:pointer-events-none",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
