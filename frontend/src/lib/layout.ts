import type { Experiment } from '@/types'

export const NODE_W = 168
export const NODE_H = 132
export const GAP_X = 40
export const BAND_H = 236
export const BAND_PAD = 130

export interface Positioned {
  id: string
  x: number
  y: number
}

/**
 * Top-down cluster layout.
 *
 * y is fixed by generation, so nodes in different generations can never
 * collide — the only collisions possible are within a single row. That lets us
 * do something simpler and far more readable than a full tidy-tree sweep:
 * cluster each sibling group tightly under its parent, then resolve overlaps
 * left to right within the row. Sibling groups stay together, and the surviving
 * lineage stays near the middle instead of walking off to one side.
 */
export function layoutTree(experiments: Experiment[]): Map<string, Positioned> {
  const pos = new Map<string, Positioned>()
  if (!experiments.length) return pos

  const gens = [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b)
  const step = NODE_W + GAP_X

  for (const gen of gens) {
    const rows = experiments.filter((e) => e.generation === gen)

    // Group by parent. Anything whose parent is missing or unplaced is treated
    // as its own root cluster so bad data still renders somewhere sensible.
    const groups = new Map<string, Experiment[]>()
    for (const e of rows) {
      const key = e.parent_id && pos.has(e.parent_id) ? e.parent_id : '__root__'
      const list = groups.get(key) ?? []
      list.push(e)
      groups.set(key, list)
    }

    const clusters = [...groups.entries()]
      .map(([parentId, members]) => {
        members.sort((a, b) => a.id.localeCompare(b.id))
        const center = parentId === '__root__' ? 0 : pos.get(parentId)!.x
        return { parentId, members, center }
      })
      .sort((a, b) => a.center - b.center || a.parentId.localeCompare(b.parentId))

    let minAllowed = -Infinity
    for (const cluster of clusters) {
      const n = cluster.members.length
      let start = cluster.center - ((n - 1) / 2) * step
      // Keep clusters from overlapping their left-hand neighbour in this row.
      if (start < minAllowed) start = minAllowed
      cluster.members.forEach((e, i) => {
        pos.set(e.id, { id: e.id, x: start + i * step, y: gen * BAND_H })
      })
      minAllowed = start + (n - 1) * step + step
    }
  }

  return pos
}

export function treeExtent(pos: Map<string, Positioned>) {
  const xs = [...pos.values()].map((p) => p.x)
  if (!xs.length) return { minX: 0, maxX: 0, width: 0 }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  return { minX, maxX, width: maxX - minX + NODE_W }
}

export function generationsOf(experiments: Experiment[]): number[] {
  return [...new Set(experiments.map((e) => e.generation))].sort((a, b) => a - b)
}
