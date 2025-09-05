import { NavLink } from 'react-router-dom'
import { 
  Home, 
  FolderOpen, 
  Share2, 
  Trash2, 
  Settings, 
  HardDrive,
  Upload,
  Users,
  FileCheck
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const navItems = [
  { path: '/dashboard', icon: Home, label: '仪表盘', roles: ['admin'] },
  { path: '/files', icon: FolderOpen, label: '我的文件', roles: ['admin', 'user', 'guest'] },
  { path: '/shared', icon: Share2, label: '共享文件', roles: ['admin', 'user'] },
  { path: '/users', icon: Users, label: '用户管理', roles: ['admin'] }, // 只有管理员可见
  { path: '/invitations', icon: FileCheck, label: '邀请码管理', roles: ['admin'] },
  { path: '/upload-manage', icon: FileCheck, label: '上传管理', roles: ['admin'] }, // 只有管理员可见
  { path: '/trash', icon: Trash2, label: '回收站', roles: ['admin', 'user'] },
  { path: '/settings', icon: Settings, label: '设置', roles: ['admin', 'user', 'guest'] },
]

export function AppSidebar() {
  const user = useAuthStore((state) => state.user)

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <HardDrive className="w-8 h-8 text-primary" />
          <span className="text-xl font-semibold">MyWebDrive</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navItems
            .filter((item) => !user || item.roles.includes(user.role))
            .map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 ${
                        isActive ? 'bg-accent text-accent-foreground' : ''
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
        </SidebarMenu>

        {/* 上传按钮和slot信息 */}
        <div className="px-3 py-2 space-y-2">
          <Button 
            className="w-full" 
            size="sm"
            disabled={user?.role === 'guest' || (user?.role === 'user' && user.pendingUploads >= user.uploadSlots)}
          >
            <Upload className="w-4 h-4 mr-2" />
            上传文件
          </Button>
          
          {/* 用户上传slot信息 */}
          {user?.role === 'user' && (
            <div className="text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>上传槽位:</span>
                <span>{user.pendingUploads}/{user.uploadSlots}</span>
              </div>
              {user.pendingUploads >= user.uploadSlots && (
                <div className="text-red-500 mt-1">
                  已达上传限制
                </div>
              )}
            </div>
          )}
          
          {user?.role === 'guest' && (
            <div className="text-xs text-muted-foreground text-center">
              游客无法上传文件
            </div>
          )}
        </div>
      </SidebarContent>

      {/* 存储空间信息 */}
      {user && (
        <SidebarFooter>
          <div className="px-3 py-2 space-y-2">
            <div className="text-sm font-medium">存储空间</div>
            <Progress 
              value={(user.storageUsed / user.storageQuota) * 100} 
              className="h-2"
            />
            <div className="text-xs text-muted-foreground">
              {formatBytes(user.storageUsed)} / {formatBytes(user.storageQuota)}
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
