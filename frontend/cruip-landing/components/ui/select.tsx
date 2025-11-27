"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal Select: renders a native <select> by collecting SelectItem children.

type Item = { value: string; label: string };

type SelectItemProps = { value: string; children?: React.ReactNode };

function collectItems(children: React.ReactNode): Item[] {
  const items: Item[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;

    const type = child.type as { displayName?: string };
    const props = child.props as SelectItemProps;
    if (type.displayName === "SelectItem") {
      items.push({
        value: props.value,
        label: String(props.children ?? props.value),
      });
    }

    if (props?.children) {
      items.push(...collectItems(props.children));
    }
  });
  return items;
}

export function Select({ value, defaultValue, onValueChange, children, className }:{
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string)=>void;
  children?: React.ReactNode;
  className?: string;
}){
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const current = value !== undefined ? value : internal;
  const items = React.useMemo(()=>collectItems(children), [children]);
  return (
    <div className={cn("inline-block", className)}>
      <select
        className={cn("h-9 w-[180px] rounded-md border bg-background px-3 text-sm shadow-sm" )}
        value={current}
        onChange={(e)=>{ setInternal(e.target.value); onValueChange?.(e.target.value); }}
      >
        {items.map(it => (
          <option key={it.value} value={it.value}>{it.label}</option>
        ))}
      </select>
    </div>
  );
}

export const SelectTrigger = ({ className, children }:{ className?: string; children?: React.ReactNode }) => (
  <div className={className}>{children}</div>
);
export const SelectContent = ({ children }:{ children?: React.ReactNode }) => <>{children}</>;
export const SelectValue = ({ placeholder }:{ placeholder?: string }) => <span className="text-sm text-muted-foreground">{placeholder}</span>;
export const SelectItem = ({ value, children }:{ value: string; children?: React.ReactNode }) => <div data-value={value}>{children}</div>;
SelectItem.displayName = "SelectItem";

