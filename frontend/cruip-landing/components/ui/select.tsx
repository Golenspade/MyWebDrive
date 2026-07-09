"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Item = { value: string; label: string };

type SelectItemElement = React.ReactElement<{ value: string; children?: React.ReactNode }>;

function isSelectItemElement(node: React.ReactNode): node is SelectItemElement {
  return (
    React.isValidElement(node) &&
    (node.type as { displayName?: string }).displayName === "SelectItem"
  );
}

function collectItems(children: React.ReactNode): Item[] {
  const items: Item[] = [];
  React.Children.forEach(children, (child) => {
    if (isSelectItemElement(child)) {
      items.push({
        value: child.props.value,
        label: String(child.props.children ?? child.props.value),
      });
    } else if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      items.push(...collectItems(child.props.children));
    }
  });
  return items;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const current = value !== undefined ? value : internal;
  const items = React.useMemo(() => collectItems(children), [children]);
  return (
    <div className={cn("inline-block", className)}>
      <select
        className={cn(
          "flex h-11 w-full items-center rounded-[var(--nothing-r-sm)] border border-nothing-line-2 bg-nothing-surface px-3 py-2 text-sm font-nothing-ui text-nothing-primary outline-none transition-colors duration-200 ease-in-out hover:border-nothing-primary focus-visible:border-nothing-primary focus-visible:outline-[2px] focus-visible:outline-offset-2 focus-visible:outline-[var(--nothing-focus)] disabled:pointer-events-none disabled:opacity-30 appearance-none cursor-pointer"
        )}
        value={current}
        onChange={(e) => {
          setInternal(e.target.value);
          onValueChange?.(e.target.value);
        }}
      >
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export const SelectTrigger = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <div className={className}>{children}</div>;

export const SelectContent = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

export const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span className="text-sm font-nothing-ui text-nothing-muted">{placeholder}</span>
);

export const SelectItem = ({
  value,
  children,
}: {
  value: string;
  children?: React.ReactNode;
}) => <div data-value={value}>{children}</div>;
SelectItem.displayName = "SelectItem";
