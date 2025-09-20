import React from 'react'
import type { WordMode } from '@/types/wordcloud'
import mygoData from '@/data/wordcloud/mygo.json'
import aveData from '@/data/wordcloud/ave.json'
import { useWordCloudFlow } from './useWordCloudFlow'
import { bgClassFor } from './utils'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'

interface Props {
  onDone?: () => void
}

export default function WordCloudIntro({ onDone }: Props) {
  const [mode, setMode] = React.useState<WordMode>('mygo')
  const { setTheme } = useTheme()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const speedRef = React.useRef(1)
  const [fadeOut, setFadeOut] = React.useState(false)

  const data = mode === 'mygo' ? mygoData : aveData
  const { items } = useWordCloudFlow(mode, data)

  // theme sync
  React.useEffect(() => {
    setTheme(mode === 'ave' ? 'dark' : 'light')
  }, [mode, setTheme])

  // scroll-driven speed and completion
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      const mul = Math.min(5, 1 + Math.max(0, y - 100) / vh * 4)
      speedRef.current = mul
      if (containerRef.current) {
        containerRef.current.style.setProperty('--wc-speed', String(mul))
      }
      if (y > vh * 0.8) {
        setFadeOut(true)
        // allow fade then notify
        window.setTimeout(() => onDone && onDone(), 500)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [onDone])

  const toggleMode = () => setMode((m) => (m === 'mygo' ? 'ave' : 'mygo'))

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 pointer-events-auto overflow-hidden bg-gradient-to-br ${bgClassFor(mode)} transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
      style={{
        // speed multiplier for CSS animations
        // @ts-ignore custom var
        '--wc-speed': 1,
      } as React.CSSProperties}
    >
      {/* Mode toggle */}
      <div className="absolute right-4 top-4 z-[60]">
        <Button variant="secondary" onClick={toggleMode}>{mode === 'mygo' ? '切到 Ave Mujica' : '切到 MyGO'}</Button>
      </div>

      {/* Words */}
      <div className="absolute inset-0">
        {items.map((w) => {
          const base = w.baseDuration
          const duration = `calc(${base}s / var(--wc-speed))`
          const anim = w.direction === 'lr'
            ? 'wc-move-lr'
            : w.direction === 'rl'
            ? 'wc-move-rl'
            : w.direction === 'tb'
            ? 'wc-move-tb'
            : 'wc-move-bt'
          return (
            <span
              key={w.id}
              className={`absolute select-none whitespace-nowrap will-change-transform mix-blend-plus-lighter hover:scale-110 transition-transform duration-200`}
              style={{
                left: w.x,
                top: w.y,
                fontSize: w.size,
                color: w.color,
                animation: `${anim} ${duration} linear infinite` as any,
              }}
            >
              {w.text}
            </span>
          )
        })}
      </div>

      {/* keyframes scoped in component */}
      <style>{`
        @keyframes wc-move-lr { from { transform: translateX(-20vw); } to { transform: translateX(120vw); } }
        @keyframes wc-move-rl { from { transform: translateX(120vw); } to { transform: translateX(-20vw); } }
        @keyframes wc-move-tb { from { transform: translateY(-20vh); } to { transform: translateY(120vh); } }
        @keyframes wc-move-bt { from { transform: translateY(120vh); } to { transform: translateY(-20vh); } }
      `}</style>
    </div>
  )
}

