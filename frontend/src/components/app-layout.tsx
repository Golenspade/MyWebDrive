import { Outlet } from 'react-router-dom'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ReactNode } from 'react'

interface AppLayoutProps {
  children?: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      {/* 侧边栏 */}
      <AppSidebar />

      {/* 使用 SidebarInset 作为主内容容器，确保内容自然占满剩余宽度 */}
      <SidebarInset>
        {/* 顶部导航栏 */}
        <AppHeader />
        {/* 页面内容 */}
        <main className="flex-1 overflow-auto">
          {children ? children : <Outlet />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
