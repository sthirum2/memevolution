import type { Experiment, ExperimentStatus } from '@/types'
import { clamp } from './format'

/**
 * Colour is reserved for fitness signal. These are the only places in the app
 * allowed to decide what a number looks like.
 */
export const C = {
  acid: '#C7F04A',
  acidDim: '#8FAE33',
  rust: '#C4502E',
  rustDim: '#8A3A21',
  probe: '#58B6C4',
  probeDim: '#3C7B85',
  bone: '#EDE8E0',
  smoke: '#6B7076',
  ash: '#1B1F22',
  graphite: '#121517',
  void: '#08090A',
} as const

/** The number an experiment is judged by: observed if we have it, else the model's guess. */
export function effectiveFitness(e: Experiment): number {
  return e.observed.fitness ?? e.prediction.fitness ?? 0
}

/** Did reality beat the model, or embarrass it? null while unobserved. */
export function surprise(e: Experiment): number | null {
  if (e.observed.fitness === null) return null
  return Math.round((e.observed.fitness - e.prediction.fitness) * 100) / 100
}

/** A miss this large is worth shouting about in the UI. */
export const ANOMALY_THRESHOLD = 0.15
export function isAnomaly(e: Experiment): boolean {
  const s = surprise(e)
  return s !== null && Math.abs(s) >= ANOMALY_THRESHOLD
}

/** Low fitness should look sickly, not merely smaller. */
export function fitnessColor(f: number, status?: ExperimentStatus): string {
  if (status === 'extinct') return C.rust
  if (status === 'pending') return C.smoke
  if (status === 'predicted') return C.probe
  if (f >= 0.7) return C.acid
  if (f >= 0.5) return C.acidDim
  if (f >= 0.35) return '#9A8F4E'
  return C.rustDim
}

export function statusColor(status: ExperimentStatus): string {
  switch (status) {
    case 'survived':
      return C.acid
    case 'deployed':
      return C.acid
    case 'predicted':
      return C.probe
    case 'pending':
      return C.smoke
    case 'extinct':
      return C.rust
  }
}

export const STATUS_LABEL: Record<ExperimentStatus, string> = {
  pending: 'awaiting score',
  predicted: 'scored',
  deployed: 'live',
  survived: 'survived',
  extinct: 'extinct',
}

/** Node geometry scales with fitness — a weak specimen is literally smaller. */
export function nodeScale(f: number): number {
  return 0.78 + clamp(f) * 0.36
}

/** Faster pulse = more alive. Dead things do not pulse at all. */
export function pulseSeconds(f: number): number {
  return 2.9 - clamp(f) * 1.5
}

export function opacityFor(status: ExperimentStatus): number {
  if (status === 'extinct') return 0.38
  if (status === 'pending') return 0.55
  return 1
}

/** Traits rendered as bar meters, in the order the lab report reads them. */
export const NUMERIC_TRAITS = [
  'absurdity',
  'irony',
  'relatability',
  'trend_relevance',
  'text_density',
] as const

export const CATEGORICAL_TRAITS = ['topic', 'humor', 'format', 'hook', 'audio_strategy'] as const

export const BELIEF_TRAITS = [
  'absurdity',
  'irony',
  'relatability',
  'trend_relevance',
  'text_density',
  'short_video',
  'trending_audio',
  'short_caption',
] as const

export const BELIEF_COLORS: Record<string, string> = {
  absurdity: '#C7F04A',
  irony: '#C4502E',
  relatability: '#58B6C4',
  trend_relevance: '#D9A441',
  text_density: '#8A7FB5',
  short_video: '#7FD1A8',
  trending_audio: '#D96FA0',
  short_caption: '#8FAE33',
}

/** Pearson r — the "is the agent actually learning?" number on the mind view. */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0,
    dx = 0,
    dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000
}

/** Mean absolute error between prediction and observation. */
export function mae(pairs: { p: number; o: number }[]): number {
  if (!pairs.length) return 0
  return (
    Math.round((pairs.reduce((a, b) => a + Math.abs(b.o - b.p), 0) / pairs.length) * 1000) / 1000
  )
}
