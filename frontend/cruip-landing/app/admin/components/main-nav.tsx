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
    { label: 'Overview', href: '/admin/overview' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Notifications', href: '/admin/notifications' },
  ]
  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-sm font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-primary"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )}
