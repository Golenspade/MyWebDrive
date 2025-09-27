"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

const Ctx = React.createContext<{open:boolean; setOpen:(v:boolean)=>void} | null>(null);

export function DropdownMenu({ children }:{ children?: React.ReactNode }){
  const [open, setOpen] = React.useState(false);
  return <Ctx.Provider value={{open, setOpen}}><div className="relative inline-block">{children}</div></Ctx.Provider>;
}

export function DropdownMenuTrigger({ asChild, children }:{ asChild?: boolean; children: React.ReactElement }){
  const ctx = React.useContext(Ctx)!;
  if (asChild) {
    return React.cloneElement(children, { onClick: (e:any)=>{ children.props.onClick?.(e); ctx.setOpen(!ctx.open); } });
  }
  return <button onClick={()=>ctx.setOpen(!ctx.open)}>{children}</button>;
}

export function DropdownMenuContent({ align, className, children }:{ align?: "start"|"end"; className?: string; children?: React.ReactNode }){
  const ctx = React.useContext(Ctx)!;
  if (!ctx.open) return null;
  return (
    <div className={cn("absolute z-50 mt-2 min-w-[180px] rounded-md border bg-background p-1 shadow-md", align === "end" ? "right-0" : "left-0", className)}>
      {children}
    </div>
  );
}

export function DropdownMenuItem({ asChild, className, children }:{ asChild?: boolean; className?: string; children: React.ReactElement | React.ReactNode }){
  const content = asChild && React.isValidElement(children)
    ? React.cloneElement(children as any, { className: cn("block w-full rounded-sm px-2 py-1.5 text-sm hover:bg-muted", (children as any).props?.className) })
    : <div className={cn("rounded-sm px-2 py-1.5 text-sm hover:bg-muted", className)}>{children}</div>;
  return content;
}

