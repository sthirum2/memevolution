import type { Experiment, ExperimentStatus } from '@/types'

/** The only place that decides what a number looks like. */
export const C = {
  win: '#15A34A',
  winSoft: '#E7F6ED',
  dead: '#DB5C4C',
  deadSoft: '#FCECEA',
  guess: '#3B7DF6',
  guessSoft: '#EAF1FE',
  mid: '#E0A020',
  midSoft: '#FDF3E0',
  agent: '#6D4AFF',
  agentSoft: '#F0ECFF',
  ink: '#17171A',
  muted: '#71716B',
  line: '#E6E4DE',
} as const

export function effectiveFitness(e: Experiment): number {
  return e.observed.fitness ?? e.prediction.fitness ?? 0
}

/** How far reality beat (or embarrassed) the model. null while unobserved. */
export function surprise(e: Experiment): number | null {
  if (e.observed.fitness === null) return null
  return Math.round((e.observed.fitness - e.prediction.fitness) * 100) / 100
}

export const BIG_SURPRISE = 0.15

export function scoreColor(f: number): string {
  if (f >= 0.7) return C.win
  if (f >= 0.5) return '#7BA82F'
  if (f >= 0.35) return C.mid
  return C.dead
}

/** Plain-English status, which is what the cards actually show. */
export const STATUS: Record<
  ExperimentStatus,
  { label: string; tone: 'win' | 'dead' | 'guess' | 'muted' }
> = {
  survived: { label: 'Winner', tone: 'win' },
  deployed: { label: 'Posted — results coming in', tone: 'win' },
  extinct: { label: 'Eliminated', tone: 'dead' },
  predicted: { label: 'Not posted yet', tone: 'guess' },
  pending: { label: 'Being written', tone: 'muted' },
}

export const BELIEF_TRAITS = [
  'absurdity',
  'relatability',
  'short_video',
  'trending_audio',
  'trend_relevance',
  'short_caption',
  'irony',
  'text_density',
] as const

export const BELIEF_COLORS: Record<string, string> = {
  absurdity: '#6D4AFF',
  relatability: '#15A34A',
  short_video: '#3B7DF6',
  trending_audio: '#E0A020',
  trend_relevance: '#0EA5A5',
  short_caption: '#8B5CF6',
  irony: '#DB5C4C',
  text_density: '#94928B',
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100
}
