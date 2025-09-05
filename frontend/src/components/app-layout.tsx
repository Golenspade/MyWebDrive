import { Outlet } from 'react-router-dom'
import { AppSidebar } from './app-sidebar'
import { AppHeader } from './app-header'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ReactNode } from 'react'

interface AppLayoutProps {
  children?: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        {/* 侧边栏 */}
        <AppSidebar />
        
        {/* 主内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 顶部导航栏 */}
          <AppHeader />
          
          {/* 页面内容 */}
          <main className="flex-1 overflow-auto">
            {children ? children : <Outlet />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
