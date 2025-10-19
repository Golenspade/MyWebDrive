'use client'

import { ReactNode } from 'react'
import { useProtectedAdmin } from '@/lib/hooks/use-protected'
import SiteFooter from '@/components/site-footer'
import { AdminMenubar } from './components/admin-menubar'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { ready } = useProtectedAdmin()
  if (!ready) return null
  return (
    <div className='min-h-screen flex flex-col'>
      <AdminMenubar />
      <div className='flex-1'>
        {children}
      </div>
      <SiteFooter />
    </div>
  )
}
