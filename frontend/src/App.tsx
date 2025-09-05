import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import FilesPage from './pages/FilesPage'
import UsersPage from './pages/UsersPage'
import UploadManagePage from './pages/UploadManagePage'
import InvitationsPage from './pages/InvitationsPage'
import DebugPage from './pages/DebugPage'
import NotFoundPage from './pages/NotFoundPage'
import { Toaster } from './components/ui/toaster'

// 根路径组件，包含通用布局
function RootLayout() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Outlet />
      <Toaster />
    </div>
  )
}

// 认证守卫组件
function AuthGuard({ children, requireAuth = true, requiredRole }: {
  children: React.ReactNode,
  requireAuth?: boolean,
  requiredRole?: 'admin' | 'user' | 'guest'
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const fetchUserProfile = useAuthStore((state) => state.fetchUserProfile)
  const [isLoadingUser, setIsLoadingUser] = React.useState(false)

  // 如果已登录但用户信息为空，尝试获取用户信息
  React.useEffect(() => {
    if (isAuthenticated && !user && !isLoadingUser) {
      setIsLoadingUser(true)
      fetchUserProfile()
        .then(() => setIsLoadingUser(false))
        .catch(() => {
          setIsLoadingUser(false)
          // 如果获取用户信息失败，logout已经在fetchUserProfile中处理了
          console.error('Failed to fetch user profile')
        })
    }
  }, [isAuthenticated, user, isLoadingUser, fetchUserProfile])

  // 如果不需要认证，直接渲染子组件
  if (!requireAuth) {
    return <>{children}</>
  }

  // 如果需要认证但未登录，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 如果已登录但用户信息为空且正在加载，显示加载状态
  if (isAuthenticated && !user && isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在加载用户信息...</p>
        </div>
      </div>
    )
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

// 登录页面守卫 - 已登录用户重定向到对应页面
function LoginGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)

  // 重要：若用户信息未加载（user 为空），不要阻止访问登录/注册页
  if (!isAuthenticated || !user) {
    return <>{children}</>
  }

  // 已登录且拿到了用户信息，再根据角色进行重定向
  if (user.role === 'admin') return <Navigate to="/dashboard" replace />
  return <Navigate to="/files" replace />
}

// 创建路由配置
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        path: "",
        element: <HomePage />
      },
      {
        path: "login",
        element: (
          <LoginGuard>
            <LoginPage />
          </LoginGuard>
        )
      },
      {
        path: "register",
        element: (
          <LoginGuard>
            <RegisterPage />
          </LoginGuard>
        )
      },
      {
        path: "forgot-password",
        element: (
          <LoginGuard>
            <div>忘记密码页面</div>
          </LoginGuard>
        )
      },
      {
        path: "dashboard",
        element: (
          <AuthGuard requiredRole="admin">
            <DashboardPage />
          </AuthGuard>
        )
      },
      {
        path: "files/:folderId?",
        element: (
          <AuthGuard>
            <FilesPage />
          </AuthGuard>
        )
      },
      {
        path: "shared",
        element: (
          <AuthGuard>
            <div>共享文件页面</div>
          </AuthGuard>
        )
      },
      {
        path: "users",
        element: (
          <AuthGuard requiredRole="admin">
            <UsersPage />
          </AuthGuard>
        )
      },
      {
        path: "invitations",
        element: (
          <AuthGuard requiredRole="admin">
            <InvitationsPage />
          </AuthGuard>
        )
      },
      {
        path: "upload-manage",
        element: (
          <AuthGuard requiredRole="admin">
            <UploadManagePage />
          </AuthGuard>
        )
      },
      {
        path: "trash",
        element: (
          <AuthGuard>
            <div>回收站页面</div>
          </AuthGuard>
        )
      },
      {
        path: "settings",
        element: (
          <AuthGuard>
            <div>设置页面</div>
          </AuthGuard>
        )
      },
      {
        path: "debug",
        element: <DebugPage />
      },
      {
        path: "*",
        element: <NotFoundPage />
      }
    ]
  }
])

function App() {
  return <RouterProvider router={router} />
}

export default App
