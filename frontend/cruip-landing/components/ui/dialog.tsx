"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onOpenChange, children }:{ open?: boolean; onOpenChange?: (v:boolean)=>void; children?: React.ReactNode }){
  React.useEffect(()=>{
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onOpenChange?.(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">{children}</div>;
}

export const DialogContent = ({ className, children }:{ className?: string; children?: React.ReactNode }) => (
  <div className={cn("w-full max-w-lg rounded-xl border bg-background p-4 shadow-lg", className)}>{children}</div>
);

export const DialogHeader = ({ className, children }:{ className?: string; children?: React.ReactNode }) => (
  <div className={cn("mb-3", className)}>{children}</div>
);
export const DialogTitle = ({ className, children }:{ className?: string; children?: React.ReactNode }) => (
  <h3 className={cn("text-lg font-semibold", className)}>{children}</h3>
);

