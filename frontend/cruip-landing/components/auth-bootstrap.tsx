'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'

export function AuthBootstrap() {
  const bootstrap = useAuthStore((state) => state.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return null
}
