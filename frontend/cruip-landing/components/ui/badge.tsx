"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  children,
}: {
  className?: string;
  variant?: "default" | "secondary" | "outline" | "signal";
  children?: React.ReactNode;
}) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-nothing-mono font-medium uppercase tracking-[0.08em]";
  const styles =
    variant === "secondary"
      ? "bg-nothing-raised text-nothing-primary"
      : variant === "outline"
      ? "border border-nothing-line-2 text-nothing-primary"
      : variant === "signal"
      ? "bg-nothing-accent text-nothing-accent-ink"
      : "bg-nothing-display text-nothing-bg";
  return <span className={cn(base, styles, className)}>{children}</span>;
}
