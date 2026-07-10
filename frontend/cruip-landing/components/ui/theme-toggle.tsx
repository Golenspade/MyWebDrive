'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'
  const label = mounted
    ? `切换到${isDark ? '浅' : '深'}色模式`
    : '切换主题'

  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className={cn('shrink-0', className)}
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      disabled={!mounted}
    >
      {mounted ? (
        isDark ? <Sun className='size-4' aria-hidden='true' /> : <Moon className='size-4' aria-hidden='true' />
      ) : (
        <Moon className='size-4 opacity-0' aria-hidden='true' />
      )}
    </Button>
  )
}
