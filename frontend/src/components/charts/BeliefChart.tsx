import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AgentState } from '@/types'
import { BELIEF_COLORS, BELIEF_TRAITS } from '@/lib/fitness'
import { fit, titleize } from '@/lib/format'
import { AXIS, GRID, TooltipShell } from './chartTheme'
import { cx } from '@/components/common/ui'

export default function BeliefChart({ states }: { states: AgentState[] }) {
  const [focus, setFocus] = useState<string | null>(null)

  const rows = states.map((s) => {
    const row: Record<string, number> = { generation: s.generation }
    for (const t of BELIEF_TRAITS) row[t] = s.beliefs[t] ?? 0
    return row
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 pr-2 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 12, bottom: 2, left: -18 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="generation" {...AXIS} tickFormatter={(v) => `G${v}`} />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              {...AXIS}
              tickFormatter={(v) => fit(v)}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(237,232,224,0.18)', strokeDasharray: '2 3' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value))
                return (
                  <TooltipShell>
                    <div className="mb-1.5 text-2xs tracking-lab text-smoke">
                      generation {label}
                    </div>
                    {sorted.map((p) => (
                      <div
                        key={String(p.dataKey)}
                        className="flex items-center justify-between gap-4 py-px"
                      >
                        <span className="flex items-center gap-1.5 text-2xs text-bone/75">
                          <span
                            className="inline-block h-[3px] w-3"
                            style={{ background: p.color }}
                          />
                          {titleize(String(p.dataKey))}
                        </span>
                        <span className="num text-2xs text-bone">{fit(Number(p.value))}</span>
                      </div>
                    ))}
                  </TooltipShell>
                )
              }}
            />
            {BELIEF_TRAITS.map((t) => {
              const dim = focus !== null && focus !== t
              return (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stroke={BELIEF_COLORS[t]}
                  strokeWidth={focus === t ? 2.2 : 1.4}
                  strokeOpacity={dim ? 0.05 : 0.95}
                  dot={{
                    r: focus === t ? 2.6 : 1.8,
                    fill: BELIEF_COLORS[t],
                    strokeWidth: 0,
                    fillOpacity: dim ? 0.05 : 1,
                  }}
                  activeDot={{ r: 3.4 }}
                  isAnimationActive
                  animationDuration={640}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 border-t border-hairline px-3 py-2">
        {BELIEF_TRAITS.map((t) => {
          const first = states[0]?.beliefs[t] ?? 0
          const last = states[states.length - 1]?.beliefs[t] ?? 0
          const d = last - first
          return (
            <button
              key={t}
              type="button"
              onMouseEnter={() => setFocus(t)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(t)}
              onBlur={() => setFocus(null)}
              className={cx(
                'flex items-center gap-1.5 text-2xs lowercase tracking-lab transition-opacity',
                focus !== null && focus !== t ? 'opacity-25' : 'opacity-100',
              )}
            >
              <span
                className="inline-block h-[3px] w-3.5"
                style={{ background: BELIEF_COLORS[t] }}
              />
              <span className="text-bone/70">{titleize(t)}</span>
              <span className="num" style={{ color: BELIEF_COLORS[t] }}>
                {d >= 0 ? '↑' : '↓'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
