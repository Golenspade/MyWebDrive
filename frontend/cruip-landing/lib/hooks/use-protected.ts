// Route protection hooks for app router pages/layouts
// Style: 2-space indent, single quotes, no semicolons

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/auth-store'

export function useProtected(requiredRole?: 'admin' | 'user') {
  const router = useRouter()
  const { hasHydrated, isAuthenticated, role } = useAuthStore()
  const [checked, setChecked] = useState(false)

  const allowed = useMemo(() => {
    if (!isAuthenticated) return false
    if (!requiredRole) return true
    if (requiredRole === 'user') return true
    return role === 'admin'
  }, [isAuthenticated, role, requiredRole])

  useEffect(() => {
    if (!hasHydrated) return
    if (!allowed) {
      router.replace('/signin')
    }
    setChecked(true)
  }, [hasHydrated, allowed, router])

  return { ready: hasHydrated && checked && allowed }
}

export function useProtectedAdmin() {
  return useProtected('admin')
}

