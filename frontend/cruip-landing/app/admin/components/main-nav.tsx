"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname() || ""
  const items = [
    { label: "Overview", href: "/admin/overview" },
    { label: "Users", href: "/admin/users" },
    { label: "Publish", href: "/admin/publish" },
    { label: "Notifications", href: "/admin/notifications" },
  ]
  return (
    <nav
      className={cn("flex items-center space-x-1", className)}
      {...props}
    >
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-[var(--nothing-r-sm)] px-3 py-1.5 font-nothing-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-opacity duration-200 ease-in-out",
              active
                ? "bg-nothing-display text-nothing-bg"
                : "text-nothing-secondary hover:bg-nothing-raised hover:text-nothing-primary"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
