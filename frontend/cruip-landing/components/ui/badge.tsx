"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, variant = "default", children }:{ className?: string; variant?: "default" | "secondary" | "outline"; children?: React.ReactNode }){
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";
  const styles = variant === "secondary" ? "bg-muted text-foreground" : variant === "outline" ? "border bg-background" : "bg-primary text-primary-foreground";
  return <span className={cn(base, styles, className)}>{children}</span>;
}

