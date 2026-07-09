"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useRouter } from "next/navigation"

export function UserNav() {
  const { user, role, logout, isAuthenticated } = useAuthStore()
  const router = useRouter()

  async function onLogout() {
    await logout()
    router.replace('/signin')
  }

  const initials = (user?.name || 'U').slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-nothing-raised text-nothing-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 border-nothing-line bg-nothing-surface text-nothing-primary"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-nothing-primary">
              {user?.name || (isAuthenticated ? 'User' : 'Guest')}
            </p>
            <p className="text-xs leading-none text-nothing-secondary">
              角色: {role || '-'}
            </p>
          </div>
          <p className="mt-1 text-[10px] font-nothing-mono leading-none text-nothing-muted break-all">
            ID: {user?.id || '-'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-nothing-line" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push('/account')}
            className="focus:bg-nothing-raised focus:text-nothing-primary"
          >
            个人中心
            <DropdownMenuShortcut className="text-nothing-muted">⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem className="focus:bg-nothing-raised focus:text-nothing-primary">
            Settings
            <DropdownMenuShortcut className="text-nothing-muted">⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => user?.id && navigator.clipboard?.writeText(user.id)}
            className="focus:bg-nothing-raised focus:text-nothing-primary"
          >
            复制用户ID
            <DropdownMenuShortcut className="text-nothing-muted">⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-nothing-line" />
        <DropdownMenuItem
          onClick={onLogout}
          className="focus:bg-nothing-raised focus:text-nothing-primary"
        >
          Log out
          <DropdownMenuShortcut className="text-nothing-muted">⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
