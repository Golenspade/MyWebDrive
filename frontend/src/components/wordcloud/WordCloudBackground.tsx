import type { WordMode } from '@/types/wordcloud'
import mygoData from '@/data/wordcloud/mygo.json'
import aveData from '@/data/wordcloud/ave.json'
import { useWordCloudFlow } from './useWordCloudFlow'
import { useTheme } from '@/hooks/use-theme'

interface Props {
  mode: WordMode
}

/**
 * A very light, slow-moving background cloud after entering the site.
 */
export default function WordCloudBackground({ mode }: Props) {
  const data = (mode === 'ave' ? aveData : mygoData).slice(0, 18)
  const { items } = useWordCloudFlow(mode, data)
  const { theme } = useTheme()

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-20 dark:opacity-15">
      {items.map((w, i) => {
        const base = w.baseDuration * 2.5 // slower
        const duration = `${base}s`
        const anim = i % 2 === 0 ? 'wcbg-pan-1' : 'wcbg-pan-2'
        const size = Math.max(12, Math.round(w.size * 0.6))
        const color = mode === 'ave' || theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)'
        return (
          <span
            key={w.id}
            className="absolute select-none whitespace-nowrap will-change-transform"
            style={{ left: w.x, top: w.y, fontSize: size, color, animation: `${anim} ${duration} linear infinite` as any }}
          >
            {w.text}
          </span>
        )
      })}
      <style>{`
        @keyframes wcbg-pan-1 { from { transform: translateX(-10vw); } to { transform: translateX(110vw); } }
        @keyframes wcbg-pan-2 { from { transform: translateY(110vh); } to { transform: translateY(-10vh); } }
      `}</style>
    </div>
  )
}

