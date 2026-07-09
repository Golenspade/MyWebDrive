"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function AdminMenubar() {
  const pathname = usePathname() || ""
  const items = [
    { label: "概览", href: "/admin/overview" },
    { label: "存储面板", href: "/admin/storage" },
    { label: "用户管理", href: "/admin/users" },
    { label: "邀请码", href: "/admin/invitations" },
    { label: "通知中心", href: "/admin/notifications" },
    { label: "发布管理", href: "/admin/publish" },
  ]

  return (
    <header className="sticky top-0 z-[var(--nothing-z-sticky)] border-b border-nothing-line bg-nothing-bg">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center px-4">
        <nav aria-label="Admin" className="flex items-center gap-1">
          {items.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
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
      </div>
    </header>
  )
}
