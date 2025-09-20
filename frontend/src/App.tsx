import React from 'react'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'

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



// 简化：将所有前端路由重定向到 Cruip 落地页
function CruipRedirect() {
  React.useEffect(() => {
    window.location.replace('/');
  }, []);
  return null;
}

// 创建路由配置（最小化）
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { path: "*", element: <CruipRedirect /> },
    ]
  }
])

function App() {
  return <RouterProvider router={router} />
}

export default App
