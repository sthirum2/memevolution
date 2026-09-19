// ─────────────────────────────────────────────────────────────────────────────
// THE SPREAD SCORE — defined once, used everywhere.
//
// The mock backend computes it and the UI explains it, so both import from
// here. If the real backend changes the weights, change them here too and the
// tooltip stays honest.
//
// The idea: score a meme on how often people *pass it on*, not how many people
// see it. Every ingredient is a rate (per viewer), so a small account that
// gets re-sent beats a large one that merely gets seen. Each rate is capped, so
// clearing the cap earns full marks for that ingredient and no more.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScorePart {
  key: 'shares' | 'saves' | 'comments' | 'likes'
  label: string
  /** Share of the final score this ingredient can contribute. */
  weight: number
  /** The rate at which this ingredient earns full marks. */
  cap: number
}

export const SCORE_PARTS: ScorePart[] = [
  { key: 'shares', label: 'Shares', weight: 0.34, cap: 0.05 },
  { key: 'saves', label: 'Saves', weight: 0.24, cap: 0.03 },
  { key: 'comments', label: 'Comments', weight: 0.18, cap: 0.015 },
  { key: 'likes', label: 'Likes', weight: 0.14, cap: 0.16 },
]

/** Reach is the only ingredient that isn't a rate, and it's deliberately small. */
export const REACH = { label: 'Reach', weight: 0.1, logCap: 5.2 }

export interface Metrics {
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
}

export function spreadScore(m: Metrics): number {
  const v = Math.max(1, m.views)
  const rates = SCORE_PARTS.reduce(
    (sum, p) => sum + p.weight * Math.min(1, m[p.key] / v / p.cap),
    0,
  )
  const reach = REACH.weight * Math.min(1, Math.log10(v) / REACH.logCap)
  return Math.min(1, Math.max(0, rates + reach))
}

export interface BreakdownRow {
  label: string
  /** "1.7%" for a rate, "16.4K" for reach. */
  display: string
  /** 0–1: how much of this ingredient's available points were earned. */
  filled: number
  /** Points contributed to the final 0–100 score. */
  points: number
  /** Most points this ingredient could contribute. */
  maxPoints: number
}

/** The same sum the score is made of, broken out so it can be shown. */
export function breakdown(m: Metrics): { rows: BreakdownRow[]; total: number } {
  const v = Math.max(1, m.views)
  const rows: BreakdownRow[] = SCORE_PARTS.map((p) => {
    const rate = m[p.key] / v
    const filled = Math.min(1, rate / p.cap)
    return {
      label: p.label,
      display: `${(rate * 100).toFixed(1)}%`,
      filled,
      points: p.weight * filled * 100,
      maxPoints: p.weight * 100,
    }
  })

  const reachFilled = Math.min(1, Math.log10(v) / REACH.logCap)
  rows.push({
    label: REACH.label,
    display: v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v),
    filled: reachFilled,
    points: REACH.weight * reachFilled * 100,
    maxPoints: REACH.weight * 100,
  })

  return { rows, total: Math.round(spreadScore(m) * 100) }
}
