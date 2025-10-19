"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menubar, MenubarMenu, MenubarTrigger } from '@/components/ui/menubar'

export function AdminMenubar() {
  const pathname = usePathname() || ''
  const items = [
    { label: '总览', href: '/admin/overview' },
    { label: '存储面板', href: '/admin/storage' },
    { label: '用户管理', href: '/admin/users' },
    { label: '邀请码', href: '/admin/invitations' },
    { label: '通知中心', href: '/admin/notifications' },
    { label: '发布管理', href: '/admin/publish' },
  ]
  return (
    <div className='border-b'>
      <div className='flex h-12 items-center px-4'>
        <Menubar className='bg-transparent border-0 shadow-none'>
          {items.map((item) => {
            const active = pathname === item.href
            return (
              <MenubarMenu key={item.href}>
                <MenubarTrigger
                  asChild
                  className={cn(active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-primary')}
                >
                  <Link href={item.href} aria-current={active ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </MenubarTrigger>
              </MenubarMenu>
            )
          })}
        </Menubar>
      </div>
    </div>
  )
}

