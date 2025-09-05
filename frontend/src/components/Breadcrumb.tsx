import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
// import { useFileStore } from '@/stores/fileStore'

export default function Breadcrumb() {
  // const currentFolderId = useFileStore((state) => state.currentFolderId)
  
  // TODO: 实现完整的面包屑路径
  const breadcrumbs = [
    { id: null, name: '我的文件', path: '/dashboard' },
    // 这里应该根据currentFolderId获取完整路径
  ]

  return (
    <nav className="flex items-center space-x-2">
      <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
        <Home className="w-5 h-5" />
      </Link>
      
      {breadcrumbs.map((item, index) => (
        <div key={item.id || 'root'} className="flex items-center">
          <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
          {index === breadcrumbs.length - 1 ? (
            <span className="text-gray-900 font-medium">{item.name}</span>
          ) : (
            <Link to={item.path} className="text-gray-600 hover:text-gray-900">
              {item.name}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
