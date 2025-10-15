// Lightweight hook to read auth store with hydration guard
// Style: 2-space indent, single quotes, no semicolons

'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/auth-store'

export function useAuth() {
  const state = useAuthStore()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (state.hasHydrated) setReady(true)
  }, [state.hasHydrated])
  return { ...state, ready }
}

