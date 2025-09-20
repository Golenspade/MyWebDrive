import type { WordEntry, WordMode, CloudItem } from '@/types/wordcloud'

// MyGO (day) palette from references
const MYGO_COLORS = ['#3388BB', '#77BBDD', '#77DD77', '#FFDD88', '#7777AA']
// Ave Mujica (night) palette based on brand/member colors
// Brand: #881144; Members: Doloris #BB9955, Mortis #779977, Timoris #335566, Amoris #AA4477
const AVE_COLORS = ['#881144', '#AA4477', '#335566', '#779977', '#BB9955']

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function mapSize(frequency: number) {
  const f = clamp(frequency, 1, 100)
  return Math.round(14 + f * 0.6) // 14px ~ 74px
}

export function mapDuration(frequency: number) {
  const f = clamp(frequency, 1, 100)
  // higher frequency -> slightly faster (shorter duration)
  return 24 - f * 0.12 // 12s ~ 23s base
}

export function pickColor(mode: WordMode, index: number) {
  const palette = mode === 'mygo' ? MYGO_COLORS : AVE_COLORS
  return palette[index % palette.length]
}

export function toCloudItems(mode: WordMode, words: WordEntry[], width: number, height: number): CloudItem[] {
  const directions: Array<CloudItem['direction']> = ['lr', 'rl', 'tb', 'bt']
  return words.map((w, i) => {
    const dir = directions[(i + Math.floor(Math.random() * 7)) % directions.length]
    // spread initial positions roughly in viewport area
    const margin = 32
    const x = Math.floor(Math.random() * Math.max(1, width - margin * 2)) + margin
    const y = Math.floor(Math.random() * Math.max(1, height - margin * 2)) + margin
    return {
      id: `${mode}-${i}-${w.text}`,
      text: w.text,
      frequency: w.frequency,
      size: mapSize(w.frequency),
      color: pickColor(mode, i),
      direction: dir,
      baseDuration: clamp(mapDuration(w.frequency) + Math.random() * 6 - 3, 8, 28),
      x, y,
    }
  })
}

export function bgClassFor(mode: WordMode) {
  // soft gradients for day vs night
  return mode === 'mygo'
    ? 'from-[#e6f3fb] via-[#f3f9ff] to-[#fff8e6]'
    : 'from-[#0a030a] via-[#1a0610] to-[#0a0d14]'
}

