'use client'

import { ReactNode } from 'react'
import { useProtectedAdmin } from '@/lib/hooks/use-protected'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { ready } = useProtectedAdmin()
  if (!ready) return null
  return <>{children}</>
}

