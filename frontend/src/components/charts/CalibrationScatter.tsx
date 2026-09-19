import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { Experiment } from '@/types'
import { C } from '@/lib/fitness'
import { delta, fit } from '@/lib/format'
import { AXIS, GRID, TooltipShell } from './chartTheme'

interface Point {
  id: string
  x: number
  y: number
  d: number
  headline: string
}

export default function CalibrationScatter({
  experiments,
  onPick,
}: {
  experiments: Experiment[]
  onPick?: (id: string) => void
}) {
  const points: Point[] = experiments
    .filter((e) => e.observed.fitness !== null && e.status !== 'pending')
    .map((e) => ({
      id: e.id,
      x: e.prediction.fitness,
      y: e.observed.fitness as number,
      d: (e.observed.fitness as number) - e.prediction.fitness,
      headline: e.content.headline,
    }))

  const beat = points.filter((p) => p.d >= 0)
  const missed = points.filter((p) => p.d < 0)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 14, right: 16, bottom: 18, left: -14 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          type="number"
          dataKey="x"
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          {...AXIS}
          tickFormatter={(v) => fit(v)}
          label={{
            value: 'predicted',
            position: 'insideBottom',
            offset: -10,
            fill: C.smoke,
            fontSize: 10,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          {...AXIS}
          tickFormatter={(v) => fit(v)}
          label={{
            value: 'observed',
            angle: -90,
            position: 'insideLeft',
            offset: 22,
            fill: C.smoke,
            fontSize: 10,
          }}
        />
        <ZAxis range={[46, 46]} />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]}
          stroke="rgba(237,232,224,0.26)"
          strokeDasharray="3 4"
          ifOverflow="extendDomain"
        />
        <Tooltip
          cursor={{ stroke: 'rgba(237,232,224,0.16)', strokeDasharray: '2 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as Point
            return (
              <TooltipShell>
                <div className="mb-1 max-w-[200px] text-2xs leading-snug text-bone">
                  {p.headline}
                </div>
                <div className="num text-2xs text-smoke">
                  {p.id.replace('exp_', '#')} · predicted {fit(p.x)} · observed {fit(p.y)}
                </div>
                <div className="num text-2xs" style={{ color: p.d >= 0 ? C.acid : C.rust }}>
                  {delta(p.d)} {p.d >= 0 ? 'better than predicted' : 'worse than predicted'}
                </div>
              </TooltipShell>
            )
          }}
        />
        <Scatter
          data={beat}
          fill={C.acid}
          fillOpacity={0.85}
          shape="circle"
          cursor="pointer"
          onClick={(e: unknown) => onPick?.((e as Point).id)}
        />
        <Scatter
          data={missed}
          fill={C.rust}
          fillOpacity={0.85}
          shape="circle"
          cursor="pointer"
          onClick={(e: unknown) => onPick?.((e as Point).id)}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
