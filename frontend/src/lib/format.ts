/** Fitness and trait values render as bare two-decimal fractions: .81 not 0.81 */
export function fit(n: number | null | undefined, dash = '—'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return dash
  const s = Math.abs(n).toFixed(2)
  const body = s.startsWith('0') ? s.slice(1) : s
  return (n < 0 ? '-' : '') + body
}

/** Signed delta, always carrying its sign: +.18 / -.33 */
export function delta(n: number | null | undefined, dash = '—'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return dash
  return (n >= 0 ? '+' : '') + fit(n)
}

/**
 * Traits live on two different scales: fractions like absurdity (.76) and
 * counts like video_length (7s). Render each the way it is actually read.
 */
export function traitNum(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) >= 1) return String(n)
  return fit(n)
}

export function traitDelta(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) >= 1) return `${n >= 0 ? '+' : ''}${n}`
  return delta(n)
}

export function compact(n: number | null | undefined, dash = '—'): string {
  if (n === null || n === undefined) return dash
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}K`
  }
  return `${(n / 1_000_000).toFixed(1)}M`
}

export function full(n: number | null | undefined, dash = '—'): string {
  if (n === null || n === undefined) return dash
  return n.toLocaleString('en-US')
}

export function pct(n: number | null | undefined, digits = 0, dash = '—'): string {
  if (n === null || n === undefined) return dash
  return `${(n * 100).toFixed(digits)}%`
}

export function clockOf(iso: string | number | Date): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

/** Hours since a timestamp, rendered as the tree/lab uses it: 6h, 2d */
export function elapsed(from: string | null): string {
  if (!from) return '—'
  const h = (Date.now() - new Date(from).getTime()) / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

export function titleize(s: string): string {
  return s.replace(/_/g, ' ')
}

export const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
