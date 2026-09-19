import { useMemo } from 'react'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { CorpusStats, Experiment } from '@/types'
import { C } from '@/lib/fitness'
import { fit, pct } from '@/lib/format'
import { AXIS } from '@/components/charts/chartTheme'
import { DivergingBar } from '@/components/common/ui'

/**
 * "Odds of going viral" is deliberately defined rather than asserted: the
 * probability that this candidate clears the corpus top decile, given the
 * model's predicted fitness and how confident the model is in it.
 */
export function viralOdds(
  exp: Experiment,
  corpus: CorpusStats | null,
): {
  odds: number
  percentile: number
  threshold: number
} {
  const dist = corpus?.fitnessDistribution ?? []
  const total = dist.reduce((a, b) => a + b.count, 0) || 1
  const f = exp.prediction.fitness

  // Percentile of the predicted fitness within the historical corpus.
  let below = 0
  for (const b of dist) {
    const hi = Number(b.bucket.split('–')[1])
    if (hi <= f) below += b.count
    else if (Number(b.bucket.split('–')[0]) < f)
      below += b.count * ((f - Number(b.bucket.split('–')[0])) / 0.1)
  }
  const percentile = below / total

  // Top decile of the corpus is the "viral" bar. Interpolate inside the bucket
  // that crosses 90% — snapping to the bucket's lower edge understates the bar
  // by up to a full bucket width and makes every candidate look like a lock.
  let cum = 0
  let threshold = 0.8
  for (const b of dist) {
    const lo = Number(b.bucket.split('–')[0])
    const hi = Number(b.bucket.split('–')[1])
    const next = cum + b.count
    if (next / total >= 0.9) {
      const need = 0.9 * total - cum
      threshold = lo + (hi - lo) * (b.count ? need / b.count : 0)
      break
    }
    cum = next
  }

  // Logistic on the distance past the bar, widened when confidence is low.
  // Low confidence flattens the curve toward a coin flip rather than sharpening it.
  const spread = 0.13 + (1 - exp.prediction.confidence) * 0.3
  const odds = 1 / (1 + Math.exp(-(f - threshold) / spread))
  return { odds: Math.max(0.02, Math.min(0.93, odds)), percentile, threshold }
}

export default function ViralOdds({
  exp,
  corpus,
}: {
  exp: Experiment
  corpus: CorpusStats | null
}) {
  const { odds, percentile, threshold } = useMemo(() => viralOdds(exp, corpus), [exp, corpus])

  const curve = useMemo(() => {
    const dist = corpus?.fitnessDistribution ?? []
    const total = dist.reduce((a, b) => a + b.count, 0) || 1
    return dist.map((b) => ({
      x: (Number(b.bucket.split('–')[0]) + Number(b.bucket.split('–')[1])) / 2,
      share: b.count / total,
    }))
  }, [corpus])

  const attrScale = Math.max(
    0.1,
    ...exp.prediction.feature_attribution.map((a) => Math.abs(a.contribution)),
  )
  const oddsColor = odds >= 0.55 ? C.acid : odds >= 0.3 ? '#9A8F4E' : C.rust

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-5">
        <div>
          <span className="lab-label">odds of going viral</span>
          <div
            className="num font-display text-[3.4rem] font-bold leading-none"
            style={{ color: oddsColor }}
          >
            {pct(odds)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 pb-1.5">
          <Row label="predicted fitness" value={fit(exp.prediction.fitness)} />
          <Row label="model confidence" value={fit(exp.prediction.confidence)} />
          <Row label="corpus percentile" value={`${Math.round(percentile * 100)}th`} />
        </div>
      </div>

      <p className="text-2xs leading-relaxed text-smoke">
        defined as the probability of clearing {fit(threshold)} — the top decile of the historical
        corpus — given this genome and how certain the model is about it. it is a model estimate,
        not a promise.
      </p>

      <div className="h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve} margin={{ top: 8, right: 6, bottom: 0, left: -28 }}>
            <defs>
              <linearGradient id="corpusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EDE8E0" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#EDE8E0" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              {...AXIS}
              tickFormatter={(v) => fit(v)}
            />
            <YAxis hide domain={[0, 'dataMax']} />
            <Area
              type="monotone"
              dataKey="share"
              stroke="rgba(237,232,224,0.34)"
              strokeWidth={1}
              fill="url(#corpusFill)"
              isAnimationActive={false}
            />
            <ReferenceLine
              x={threshold}
              stroke="rgba(237,232,224,0.3)"
              strokeDasharray="3 3"
              label={{ value: 'top decile', position: 'insideTopLeft', fill: C.smoke, fontSize: 9 }}
            />
            <ReferenceLine
              x={exp.prediction.fitness}
              stroke={oddsColor}
              strokeWidth={2}
              label={{
                value: 'this candidate',
                position: 'insideTopRight',
                fill: oddsColor,
                fontSize: 9,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2">
        <span className="lab-label">top drivers of that number</span>
        <div className="flex flex-col gap-1.5">
          {exp.prediction.feature_attribution.slice(0, 5).map((a) => (
            <DivergingBar
              key={a.feature}
              label={a.feature}
              value={a.contribution}
              scale={attrScale}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-[112px] text-2xs lowercase tracking-lab text-smoke">{label}</span>
      <span className="num text-lab text-bone">{value}</span>
    </div>
  )
}
