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

// 临时首页，避免空白和重定向循环
function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">MyWebDrive 前端已运行</h1>
      <p className="text-muted-foreground mt-2">这是占位首页。需要的话我可以接入实际页面或落地页。</p>
    </div>
  )
}

// 路由：根路径渲染首页
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
