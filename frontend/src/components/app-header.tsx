import { Search, Bell } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserNav } from './user-nav'
import { ThemeToggle } from './theme-toggle'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function AppHeader() {
  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center px-6 gap-4">
        {/* 移动端侧边栏触发器 */}
        <SidebarTrigger className="md:hidden" />

        {/* 搜索栏 */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="搜索文件和文件夹..."
              className="pl-9 w-full"
            />
          </div>
        </div>

        {/* 右侧工具栏 - 确保靠右对齐 */}
        <div className="flex items-center space-x-2 ml-auto">
          {/* 通知按钮 */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full"></span>
          </Button>

          {/* 主题切换 */}
          <ThemeToggle />

          {/* 用户菜单 */}
          <UserNav />
        </div>
      </div>
    </header>
  )
}
