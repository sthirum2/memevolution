import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '@/store/useStore'
import type { Experiment } from '@/types'
import { BELIEF_COLORS, BELIEF_TRAITS, C, pearson } from '@/lib/fitness'
import { plainTrait, score } from '@/lib/plain'
import { Section, cx } from '@/components/ui'
import { USE_MOCK } from '@/api/client'
import { fitnessText } from '@/lib/evidence'

const AXIS = {
  tick: { fill: '#71716B', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: '#E6E4DE' },
} as const

export default function LearnedView() {
  const agentStates = useStore((s) => s.agentStates)
  const experiments = useStore((s) => s.experiments)
  const open = useStore((s) => s.open)
  const setView = useStore((s) => s.setView)
  const [focus, setFocus] = useState<string | null>(null)
  const update = useStore((s) => s.lastEvolution)

  const first = agentStates[0]
  const last = agentStates[agentStates.length - 1]

  const pairs = useMemo(
    () =>
      experiments.filter(
        (e): e is Experiment & { observed: { fitness: number } } =>
          e.observed.fitness !== null && e.status !== 'pending',
      ),
    [experiments],
  )
  const r = useMemo(
    () =>
      pearson(
        pairs.map((e) => e.prediction.fitness),
        pairs.map((e) => e.observed.fitness),
      ),
    [pairs],
  )

  const lineRows = useMemo(
    () =>
      agentStates.map((s) => {
        const row: Record<string, number> = { gen: s.generation }
        for (const t of BELIEF_TRAITS) row[t] = Math.round((s.beliefs[t] ?? 0) * 100)
        return row
      }),
    [agentStates],
  )

  const points = useMemo(
    () =>
      pairs.map((e) => ({
        id: e.id,
        x: Math.round(e.prediction.fitness * 100),
        y: Math.round(e.observed.fitness * 100),
        headline: e.content.headline,
      })),
    [pairs],
  )

  // The API reconstructs earlier rows using current beliefs; do not present
  // that as measured learning history. /evolve supplies a genuine before/after.
  if (!USE_MOCK)
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
        <Section
          title="What changed after observation"
          subtitle="Before and after values returned by the agent for this session."
        >
          {update ? (
            <div className="card p-5">
              <p className="mb-4 font-semibold">Observation: {update.driverId ?? 'Not reported'}</p>
              {update.shifts.length ? (
                update.shifts.map((shift) => (
                  <div
                    key={shift.trait}
                    className="flex justify-between gap-4 border-t border-line py-3"
                  >
                    <span>{plainTrait(shift.trait)}</span>
                    <span className="num">
                      {fitnessText(shift.from)} → {fitnessText(shift.to)}
                    </span>
                  </div>
                ))
              ) : (
                <p>No belief changes reported.</p>
              )}
              <p className="mt-3 text-sm text-muted">{update.next.note}</p>
            </div>
          ) : (
            <div className="card p-5">
              Awaiting an observation and agent update. Historical belief snapshots are not
              available.
            </div>
          )}
        </Section>
        <p className="text-sm text-muted">
          Current strategy is shown above. A second generation appears only after the backend
          generates it.
        </p>
      </div>
    )

  // The backend has no /agent-states endpoint yet, so in live mode this screen
  // would otherwise render as a blank white page. Say why instead.
  if (!first || !last || agentStates.length < 2) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <div className="card p-8 text-center">
          <h2 className="font-display text-xl font-bold">Nothing to show yet</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
            This screen compares what the AI believes now against what it believed at the start. It
            needs at least two rounds of recorded beliefs, and the server has returned{' '}
            {agentStates.length === 0 ? 'none' : 'only one'}.
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
            If you are running against the live backend, it does not serve{' '}
            <code className="rounded bg-paper px-1.5 py-0.5 text-xs">GET /agent-states</code> yet.
            Set <code className="rounded bg-paper px-1.5 py-0.5 text-xs">VITE_USE_MOCK=true</code>{' '}
            in <code className="rounded bg-paper px-1.5 py-0.5 text-xs">frontend/.env</code> to see
            this screen with demo data.
          </p>
        </div>
      </div>
    )
  }

  // Biggest movers, which is what the takeaway cards talk about.
  const moves = BELIEF_TRAITS.map((t) => ({
    trait: t,
    from: first.beliefs[t] ?? 0,
    to: last.beliefs[t] ?? 0,
    delta: (last.beliefs[t] ?? 0) - (first.beliefs[t] ?? 0),
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const biggestMiss = pairs.reduce<(typeof pairs)[number] | null>((acc, e) => {
    const d = Math.abs(e.observed.fitness - e.prediction.fitness)
    const best = acc ? Math.abs(acc.observed.fitness - acc.prediction.fitness) : -1
    return d > best ? e : acc
  }, null)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6">
      {/* the headline claim */}
      <Section
        title="What the AI believes now, versus when it started"
        subtitle="These are not measurements. They are the AI's own opinions about what makes a meme spread, and they only changed when one of its experiments proved it wrong."
      >
        <div className="card divide-y divide-line">
          {moves.map((m) => {
            const up = m.delta > 0
            const changed = Math.abs(m.delta) >= 0.05
            return (
              <div
                key={m.trait}
                className="grid items-center gap-3 p-4 sm:grid-cols-[150px_1fr_130px]"
              >
                <span className="font-semibold">{plainTrait(m.trait)}</span>

                <div className="flex items-center gap-3">
                  <span className="num w-8 text-right text-sm text-muted">
                    {Math.round(m.from * 100)}
                  </span>
                  <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                    <span
                      className="absolute inset-y-0 rounded-full opacity-25"
                      style={{ width: `${m.from * 100}%`, background: BELIEF_COLORS[m.trait] }}
                    />
                    <span
                      className="absolute inset-y-0 rounded-full transition-[width] duration-700"
                      style={{
                        left: `${Math.min(m.from, m.to) * 100}%`,
                        width: `${Math.abs(m.delta) * 100}%`,
                        background: changed ? (up ? C.win : C.dead) : '#C9C6BE',
                      }}
                    />
                    <span
                      className="absolute inset-y-[-3px] w-1 rounded"
                      style={{ left: `${m.to * 100}%`, background: BELIEF_COLORS[m.trait] }}
                    />
                  </span>
                  <span className="num w-8 text-sm font-bold">{Math.round(m.to * 100)}</span>
                </div>

                <span
                  className={cx(
                    'justify-self-start rounded-full px-2.5 py-1 text-xs font-bold sm:justify-self-end',
                    !changed
                      ? 'bg-paper text-muted'
                      : up
                        ? 'bg-win-soft text-win-deep'
                        : 'bg-dead-soft text-dead',
                  )}
                >
                  {!changed
                    ? 'barely moved'
                    : `${up ? 'wants more' : 'wants less'} (${up ? '+' : '−'}${Math.abs(Math.round(m.delta * 100))})`}
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* takeaways in plain words */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Takeaway
          title={`It wants ${moves[0].delta > 0 ? 'more' : 'less'} ${plainTrait(moves[0].trait).toLowerCase()}`}
          body={`Moved from ${Math.round(moves[0].from * 100)} to ${Math.round(moves[0].to * 100)} across ${agentStates.length - 1} rounds — the single biggest change in its thinking.`}
          tone="win"
        />
        <Takeaway
          title="It got less sure about irony"
          body="The historical data said ironic posts do well. The AI raised irony, got burned, and pulled it back down. That correction is the clearest sign it is learning from its own results rather than the data it started with."
          tone="dead"
        />
        {biggestMiss ? (
          <Takeaway
            title="Its biggest miss"
            body={`It predicted ${score(biggestMiss.prediction.fitness)} for "${biggestMiss.content.headline}" and got ${score(biggestMiss.observed.fitness)}.`}
            tone="agent"
            onClick={() => {
              open(biggestMiss.id)
              setView('evolution')
            }}
          />
        ) : null}
      </div>

      {/* the trajectory */}
      <Section
        title="How its thinking changed, round by round"
        subtitle="Hover a trait to follow just that one."
      >
        <div className="card p-4">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineRows} margin={{ top: 8, right: 16, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#EFEDE8" vertical={false} />
                <XAxis
                  dataKey="gen"
                  {...AXIS}
                  tickFormatter={(v) => (v === 0 ? 'Start' : `Round ${v}`)}
                />
                <YAxis domain={[0, 100]} {...AXIS} />
                <Tooltip
                  cursor={{ stroke: '#D6D3CB' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E6E4DE',
                    boxShadow: '0 8px 24px rgba(23,23,26,0.10)',
                    fontSize: 13,
                  }}
                  formatter={(v, name) => [v, plainTrait(String(name))]}
                  labelFormatter={(v) => (v === 0 ? 'Starting point' : `Round ${v}`)}
                />
                {BELIEF_TRAITS.map((t) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    stroke={BELIEF_COLORS[t]}
                    strokeWidth={focus === t ? 3.5 : 2}
                    strokeOpacity={focus && focus !== t ? 0.12 : 1}
                    dot={false}
                    activeDot={{ r: 4 }}
                    animationDuration={600}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3">
            {BELIEF_TRAITS.map((t) => (
              <button
                key={t}
                type="button"
                onMouseEnter={() => setFocus(t)}
                onMouseLeave={() => setFocus(null)}
                className={cx(
                  'flex items-center gap-2 text-sm font-medium transition-opacity',
                  focus && focus !== t ? 'opacity-30' : 'opacity-100',
                )}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: BELIEF_COLORS[t] }} />
                {plainTrait(t)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* is it actually getting better at guessing? */}
      <Section
        title="Is it getting better at predicting?"
        subtitle="Every meme it has posted, comparing what it predicted against what really happened. Dots on the line mean a perfect guess."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="card p-4">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 18, bottom: 22, left: -12 }}>
                  <CartesianGrid stroke="#EFEDE8" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 100]}
                    {...AXIS}
                    label={{
                      value: 'What the AI predicted',
                      position: 'insideBottom',
                      offset: -12,
                      fill: '#71716B',
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0, 100]}
                    {...AXIS}
                    label={{
                      value: 'What really happened',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 24,
                      fill: '#71716B',
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    segment={[
                      { x: 0, y: 0 },
                      { x: 100, y: 100 },
                    ]}
                    stroke="#C9C6BE"
                    strokeDasharray="5 5"
                  />
                  <Tooltip
                    cursor={{ stroke: '#D6D3CB' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E6E4DE',
                      boxShadow: '0 8px 24px rgba(23,23,26,0.10)',
                      fontSize: 13,
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload as (typeof points)[number]
                      return (
                        <div className="max-w-[230px] rounded-xl border border-line bg-white p-3 shadow-lift">
                          <p className="mb-1 text-sm font-semibold leading-snug">{p.headline}</p>
                          <p className="num text-sm text-muted">
                            Predicted {p.x} · got {p.y}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={points.filter((p) => p.y >= p.x)}
                    fill={C.win}
                    shape="circle"
                    cursor="pointer"
                    onClick={(e: unknown) => {
                      open((e as { id: string }).id)
                      setView('evolution')
                    }}
                  />
                  <Scatter
                    data={points.filter((p) => p.y < p.x)}
                    fill={C.dead}
                    shape="circle"
                    cursor="pointer"
                    onClick={(e: unknown) => {
                      open((e as { id: string }).id)
                      setView('evolution')
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="card p-5">
              <p className="label">How closely they match</p>
              <p
                className="num font-display text-5xl font-bold leading-none"
                style={{ color: r > 0.5 ? C.win : r > 0.2 ? C.mid : C.dead }}
              >
                {r.toFixed(2)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                1.00 would be a perfect predictor, 0.00 would be guessing. From {points.length}{' '}
                posted memes.
              </p>
            </div>
            <div className="card flex flex-col gap-2 p-5 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: C.win }} />
                <span className="text-muted">Spread more than expected</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: C.dead }} />
                <span className="text-muted">Spread less than expected</span>
              </span>
              <p className="mt-1 text-sm text-muted">Click any dot to read that meme.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* honesty */}
      <div className="card bg-paper/60 p-6">
        <h3 className="mb-2 font-display text-lg font-bold">Worth being clear about</h3>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-ink">&ldquo;Spread score&rdquo; is our own measure</strong>, not
            a measure of going viral. It weighs shares and saves heavily and adjusts for audience
            size, so a small account that gets passed around beats a big one that just gets seen.
          </li>
          <li>
            <strong className="text-ink">
              Traits like &ldquo;weirdness&rdquo; are AI judgements
            </strong>
            , not facts about the world.
          </li>
          <li>
            <strong className="text-ink">Nothing posts on its own.</strong> The AI picks; a person
            approves.
          </li>
        </ul>
      </div>
    </div>
  )
}

function Takeaway({
  title,
  body,
  tone,
  onClick,
}: {
  title: string
  body: string
  tone: 'win' | 'dead' | 'agent'
  onClick?: () => void
}) {
  const tones = {
    win: 'bg-win-soft',
    dead: 'bg-dead-soft',
    agent: 'bg-agent-soft',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'rounded-2xl p-5 text-left',
        tones[tone],
        onClick && 'transition-transform hover:-translate-y-0.5',
      )}
    >
      <h3 className="mb-1.5 font-display font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-ink/70">{body}</p>
      {onClick ? <p className="mt-2 text-sm font-semibold text-agent">Read it →</p> : null}
    </Tag>
  )
}
