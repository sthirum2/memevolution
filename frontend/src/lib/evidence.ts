import type { LiveMetrics, MetricsInput } from '@/types'

/** Preserve missing values; zero is a real measurement. */
export function fitnessText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : 'Not available'
}

export function countText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : 'Pending'
}

export function measuredMetrics(live: LiveMetrics | null): MetricsInput | null {
  if (!live) return null
  const keys = ['views', 'likes', 'comments', 'shares', 'saves'] as const
  if (
    keys.some(
      (key) => typeof live[key] !== 'number' || !Number.isFinite(live[key]) || live[key]! < 0,
    )
  )
    return null
  return Object.fromEntries(keys.map((key) => [key, live[key]])) as unknown as MetricsInput
}

export function isVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)
}
