'use client'

import { ReactNode } from 'react'
import { useProtectedAdmin } from '@/lib/hooks/use-protected'
import { AdminMenubar } from './components/admin-menubar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { ready } = useProtectedAdmin()
  if (!ready) return null
  return (
    <div className='appwrap flex min-h-screen flex-col' data-theme='dark'>
      <AdminMenubar />
      <main className='flex-1'>
        {children}
      </main>
    </div>
  )
}
