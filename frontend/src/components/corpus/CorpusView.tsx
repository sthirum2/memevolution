import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '@/store/useStore'
import { C } from '@/lib/fitness'
import { compact, fit, titleize } from '@/lib/format'
import { AXIS, GRID, Panel, TooltipShell } from '@/components/charts/chartTheme'
import { Empty } from '@/components/common/ui'

export default function CorpusView() {
  const corpus = useStore((s) => s.corpus)
  if (!corpus) return <Empty>corpus not loaded</Empty>

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 pb-24">
        <p className="border border-hairline bg-carbon p-4 text-2xs leading-relaxed text-smoke">
          the agent does not start from nothing. generation 0 is a centroid of what already
          propagated in these datasets — everything after it is the agent's own doing. this view is
          context for the tree, not the argument itself.
        </p>

        {/* datasets */}
        <div className="grid gap-3 lg:grid-cols-3">
          {corpus.datasets.map((d) => (
            <section
              key={d.name}
              className="flex flex-col gap-2 border border-hairline bg-carbon p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xs font-bold tracking-[0.1em] text-bone">
                  {d.name}
                </span>
                <span className="num text-2xs text-acid">{d.scale}</span>
              </div>
              <p className="text-2xs leading-relaxed text-smoke">{d.description}</p>
              <div className="mt-auto flex items-baseline justify-between border-t border-hairline pt-2">
                <span className="lab-label">rows sampled</span>
                <span className="num text-lab text-bone">{compact(d.rowsSampled)}</span>
              </div>
              <span className="truncate text-2xs text-smoke/60" title={d.source}>
                {d.source}
              </span>
            </section>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel
            title="fitness distribution"
            right="historical corpus"
            subtitle="Most things do not spread. The long left tail is the base rate any candidate is competing against."
            className="h-[280px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={corpus.fitnessDistribution}
                margin={{ top: 14, right: 14, bottom: 6, left: -14 }}
              >
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="bucket" {...AXIS} interval={1} />
                <YAxis {...AXIS} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip
                  cursor={{ fill: 'rgba(237,232,224,0.04)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <TooltipShell>
                        <div className="text-2xs tracking-lab text-smoke">fitness {label}</div>
                        <div className="num text-2xs text-bone">
                          {compact(Number(payload[0].value))} posts
                        </div>
                      </TooltipShell>
                    )
                  }}
                />
                <Bar dataKey="count" isAnimationActive animationDuration={620}>
                  {corpus.fitnessDistribution.map((b, i) => (
                    <Cell
                      key={b.bucket}
                      fill={i >= 8 ? C.acid : i >= 6 ? C.acidDim : 'rgba(237,232,224,0.2)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel
            title="trait ↔ fitness correlation"
            right="pearson r"
            subtitle="Correlation in the corpus only — the agent treats these as priors to be tested, not as facts. Irony scores far lower here than the agent initially assumed."
            className="h-[280px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={corpus.traitCorrelation}
                layout="vertical"
                margin={{ top: 10, right: 20, bottom: 6, left: 74 }}
              >
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-0.35, 0.5]}
                  {...AXIS}
                  tickFormatter={(v) => fit(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="trait"
                  {...AXIS}
                  width={72}
                  interval={0}
                  tickFormatter={(v) => titleize(String(v))}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(237,232,224,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as { trait: string; correlation: number }
                    return (
                      <TooltipShell>
                        <div className="text-2xs tracking-lab text-smoke">{titleize(p.trait)}</div>
                        <div
                          className="num text-2xs"
                          style={{ color: p.correlation >= 0 ? C.acid : C.rust }}
                        >
                          r = {fit(p.correlation)}
                        </div>
                      </TooltipShell>
                    )
                  }}
                />
                <Bar dataKey="correlation" isAnimationActive animationDuration={620}>
                  {corpus.traitCorrelation.map((t) => (
                    <Cell
                      key={t.trait}
                      fill={t.correlation >= 0 ? C.acid : C.rust}
                      fillOpacity={0.82}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <Panel
          title="median share rate by format"
          right="shares ÷ views"
          subtitle="Shares are the closest thing in the data to an act of replication — someone chose to pass it on. Borrowed frames (speedrun, POV) outperform formats that ask the viewer to simply watch."
          className="h-[260px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={corpus.propagationByFormat}
              margin={{ top: 14, right: 20, bottom: 6, left: -12 }}
            >
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="format" {...AXIS} tickFormatter={(v) => titleize(String(v))} />
              <YAxis {...AXIS} tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
              <Tooltip
                cursor={{ fill: 'rgba(237,232,224,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as {
                    format: string
                    medianShareRate: number
                    n: number
                  }
                  return (
                    <TooltipShell>
                      <div className="text-2xs tracking-lab text-smoke">{titleize(p.format)}</div>
                      <div className="num text-2xs text-bone">
                        {(p.medianShareRate * 100).toFixed(1)}% median share rate
                      </div>
                      <div className="num text-2xs text-smoke">n = {compact(p.n)}</div>
                    </TooltipShell>
                  )
                }}
              />
              <Bar dataKey="medianShareRate" isAnimationActive animationDuration={620}>
                {corpus.propagationByFormat.map((f, i) => (
                  <Cell key={f.format} fill={i === 0 ? C.acid : 'rgba(237,232,224,0.24)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <p className="border border-hairline bg-carbon p-4 text-2xs leading-relaxed text-smoke">
          a caveat worth saying out loud: this is an experimental memetic fitness score, not a
          measurement of virality. it is normalised for reach and weighted toward propagation, and
          semantic traits are model classifications rather than ground truth.
        </p>
      </div>
    </div>
  )
}
