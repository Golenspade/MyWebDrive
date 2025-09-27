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
  <div className={cn("inline-flex rounded-md border bg-muted p-1", className)}>{children}</div>
);

export const TabsTrigger = ({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) => {
  const ctx = React.useContext(TabsCtx)!;
  const selected = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      data-state={selected ? "active" : "inactive"}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md",
        selected ? "bg-background shadow" : "text-muted-foreground hover:bg-background",
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
  return <div className={className}>{children}</div>;
};

