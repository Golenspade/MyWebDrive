import { useEffect, useMemo, useState } from 'react'
import type { WordEntry, WordMode, CloudItem } from '@/types/wordcloud'
import { toCloudItems } from './utils'

/**
 * Prepare cloud items and recompute on mode/words/viewport change.
 * Movement itself is handled by CSS animations driven by a speed CSS var.
 */
export function useWordCloudFlow(mode: WordMode, words: WordEntry[]) {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const items: CloudItem[] = useMemo(() => {
    return toCloudItems(mode, words, Math.max(1, size.w), Math.max(1, size.h))
  }, [mode, words, size])

  return { items }
}

