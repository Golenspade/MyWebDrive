"use client";
import * as React from "react";

export function TooltipProvider({ children }:{ children?: React.ReactNode }){ return <>{children}</>; }
export function Tooltip({ children }:{ children?: React.ReactNode }){ return <>{children}</>; }

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  asChild?: boolean;
}

export function TooltipTrigger({ children, asChild, ...props }: TooltipTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props);
  }
  return <span {...props}>{children}</span>;
}

export function TooltipContent(_props:{ children?: React.ReactNode; className?: string }){ return null; }
