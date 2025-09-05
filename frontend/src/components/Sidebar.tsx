import { NavLink } from 'react-router-dom'
import { 
  Home, 
  FolderOpen, 
  Share2, 
  Trash2, 
  Settings, 
  HardDrive,
  Upload
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function Sidebar() {
  const user = useAuthStore((state) => state.user)

  const navItems = [
    { path: '/dashboard', icon: Home, label: '仪表盘' },
    { path: '/files', icon: FolderOpen, label: '我的文件' },
    { path: '/shared', icon: Share2, label: '共享文件' },
    { path: '/trash', icon: Trash2, label: '回收站' },
    { path: '/settings', icon: Settings, label: '设置' },
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo区域 */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <HardDrive className="w-8 h-8 text-primary-600 mr-3" />
        <span className="text-xl font-semibold text-gray-900">MyWebDrive</span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-4 py-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* 上传按钮 */}
        <button className="w-full mt-6 flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Upload className="w-5 h-5 mr-2" />
          上传文件
        </button>
      </nav>

      {/* 存储空间信息 */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2">存储空间</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{
                width: `${(user.storageUsed / user.storageQuota) * 100}%`,
              }}
            />
          </div>
          <div className="text-xs text-gray-500">
            {formatBytes(user.storageUsed)} / {formatBytes(user.storageQuota)}
          </div>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
