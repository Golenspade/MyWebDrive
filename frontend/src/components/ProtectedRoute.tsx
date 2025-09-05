import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
  requiredRole?: 'admin' | 'user' | 'guest'
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  requiredRole 
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  // 如果不需要认证，直接渲染子组件
  if (!requireAuth) {
    return <>{children}</>
  }

  // 如果需要认证但未登录，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 如果需要特定角色但用户角色不匹配
  if (requiredRole && user?.role !== requiredRole) {
    // 根据用户角色重定向到合适的页面
    const redirectPath = user?.role === 'admin' ? '/dashboard' : '/files'
    return <Navigate to={redirectPath} replace />
  }

  // 所有检查通过，渲染子组件
  return <>{children}</>
}
