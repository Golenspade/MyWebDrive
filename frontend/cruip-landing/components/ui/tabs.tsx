"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextType = {
  value: string | undefined;
  setValue: (v: string) => void;
};

const TabsCtx = React.createContext<TabsContextType | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const current = value !== undefined ? value : internal;
  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <div className={className}>
      <TabsCtx.Provider value={{ value: current, setValue }}>{children}</TabsCtx.Provider>
    </div>
  );
}

export const TabsList = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div className={cn("inline-flex rounded-[var(--nothing-r-sm)] bg-nothing-surface p-1", className)}>{children}</div>
);

export const TabsTrigger = ({
  value,
  disabled,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) => {
  const ctx = React.useContext(TabsCtx)!;
  const selected = ctx.value === value;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      data-state={selected ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--nothing-r-sm)] px-3 py-1.5 text-xs font-nothing-mono font-medium uppercase tracking-[0.08em] outline-none transition-opacity duration-200 ease-in-out focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[var(--nothing-focus)] disabled:pointer-events-none disabled:opacity-30",
        selected ? "bg-nothing-display text-nothing-bg" : "text-nothing-secondary hover:text-nothing-primary",
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) => {
  const ctx = React.useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return <div className={cn("font-nothing-ui text-nothing-primary", className)}>{children}</div>;
};
