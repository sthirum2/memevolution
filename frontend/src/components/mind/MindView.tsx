import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { BELIEF_COLORS, BELIEF_TRAITS, C, mae, pearson } from '@/lib/fitness'
import { delta, fit, titleize } from '@/lib/format'
import { Panel } from '@/components/charts/chartTheme'
import BeliefChart from '@/components/charts/BeliefChart'
import CalibrationScatter from '@/components/charts/CalibrationScatter'
import { BigNum, Empty, cx } from '@/components/common/ui'

export default function MindView() {
  const agentStates = useStore((s) => s.agentStates)
  const experiments = useStore((s) => s.experiments)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)

  const latest = agentStates[agentStates.length - 1]
  const previous = agentStates[agentStates.length - 2]

  const pairs = useMemo(
    () =>
      experiments
        .filter((e) => e.observed.fitness !== null && e.status !== 'pending')
        .map((e) => ({ p: e.prediction.fitness, o: e.observed.fitness as number })),
    [experiments],
  )

  const r = useMemo(
    () =>
      pearson(
        pairs.map((x) => x.p),
        pairs.map((x) => x.o),
      ),
    [pairs],
  )
  const err = useMemo(() => mae(pairs), [pairs])

  // Early-half vs late-half error: the actual "is it learning?" evidence.
  const half = Math.floor(pairs.length / 2)
  const earlyErr = mae(pairs.slice(0, half))
  const lateErr = mae(pairs.slice(half))
  const improving = lateErr < earlyErr

  if (!agentStates.length) return <Empty>no agent state</Empty>

  return (
    // Below xl the view scrolls as one page and every panel has a definite
    // height; at xl it becomes a fixed two-column dashboard that fills the
    // viewport. Mixing the two is what makes panels collide.
    <div className="h-full overflow-y-auto p-3 xl:overflow-hidden">
      <div className="grid gap-3 pb-24 xl:h-full xl:grid-cols-[1.55fr_1fr] xl:pb-0">
        {/* left column */}
        <div className="flex flex-col gap-3 xl:min-h-0">
          <Panel
            title="beliefs over generations"
            right="hover a trait to isolate it"
            subtitle="What the agent currently thinks each trait should be. These are not measurements — they are the agent's working model, revised only when an experiment contradicts it."
            className="h-[360px] xl:h-auto xl:min-h-[300px] xl:flex-[1.15]"
          >
            <BeliefChart states={agentStates} />
          </Panel>

          <Panel
            title="predicted vs observed"
            right={`n=${pairs.length}`}
            className="h-[420px] md:h-[300px] xl:h-auto xl:min-h-[280px] xl:flex-1"
          >
            <div className="flex h-full min-h-0 flex-col md:flex-row">
              <div className="min-h-[200px] flex-1">
                <CalibrationScatter
                  experiments={experiments}
                  onPick={(id) => {
                    select(id)
                    setView('specimen')
                  }}
                />
              </div>
              <div className="flex shrink-0 flex-col justify-center gap-4 border-t border-hairline p-4 md:w-[200px] md:border-l md:border-t-0">
                <BigNum
                  label="correlation r"
                  value={fit(r)}
                  color={r > 0.5 ? C.acid : r > 0.2 ? '#9A8F4E' : C.rust}
                  size="sm"
                  sub="predicted against observed"
                />
                <BigNum
                  label="mean abs error"
                  value={fit(err)}
                  color={C.probe}
                  size="sm"
                  sub="average miss per experiment"
                />
                <div className="border-t border-hairline pt-3">
                  <span className="lab-label">calibration trend</span>
                  <p className="mt-1 text-2xs leading-relaxed text-smoke">
                    first half {fit(earlyErr)} → second half {fit(lateErr)}.{' '}
                    <span style={{ color: improving ? C.acid : C.rust }}>
                      {improving
                        ? 'the model is getting less wrong as it accumulates its own observations.'
                        : 'error has not fallen yet — more generations needed.'}
                    </span>
                  </p>
                </div>
                <p className="text-2xs leading-relaxed text-smoke">
                  points above the diagonal spread further than the model expected. those are the
                  interesting ones — click any point to open its lab report.
                </p>
              </div>
            </div>
          </Panel>
        </div>

        {/* right column */}
        <div className="flex flex-col gap-3 xl:min-h-0">
          <Panel
            title="current strategy"
            right={`generation ${latest.generation}`}
            className="shrink-0"
          >
            <div className="flex flex-col gap-2.5 p-3">
              {BELIEF_TRAITS.map((t) => {
                const v = latest.beliefs[t] ?? 0
                const prev = previous?.beliefs[t]
                const conf = latest.confidence[t] ?? 0.4
                const d = prev === undefined ? 0 : v - prev
                const arrow = Math.abs(d) < 0.005 ? '—' : d > 0 ? '▲' : '▼'
                const color = Math.abs(d) < 0.005 ? C.smoke : d > 0 ? C.acid : C.rust
                return (
                  <div key={t} className="grid grid-cols-[96px_1fr_40px_46px] items-center gap-2">
                    <span
                      className="truncate text-2xs lowercase tracking-lab text-smoke"
                      title={titleize(t)}
                    >
                      {titleize(t)}
                    </span>
                    <span className="relative h-[3px] w-full bg-[rgba(237,232,224,0.07)]">
                      {/* confidence band: how far the belief might really sit */}
                      <span
                        className="absolute inset-y-[-3px]"
                        style={{
                          left: `${Math.max(0, v - (1 - conf) * 0.22) * 100}%`,
                          width: `${Math.min(1, (1 - conf) * 0.44) * 100}%`,
                          background: `${BELIEF_COLORS[t]}1F`,
                        }}
                        title={`confidence ${fit(conf)}`}
                      />
                      <span
                        className="absolute inset-y-0 left-0 transition-[width] duration-700"
                        style={{
                          width: `${v * 100}%`,
                          background: BELIEF_COLORS[t],
                          opacity: 0.35 + conf * 0.65,
                        }}
                      />
                      <span
                        className="absolute top-[-3px] h-[9px] w-[2px]"
                        style={{ left: `${v * 100}%`, background: BELIEF_COLORS[t] }}
                      />
                    </span>
                    <span className="num text-right text-lab text-bone/90">{fit(v)}</span>
                    <span className="num text-right text-2xs" style={{ color }}>
                      {arrow} {Math.abs(d) < 0.005 ? '' : delta(d)}
                    </span>
                  </div>
                )
              })}
              <p className="border-t border-hairline pt-2 text-2xs leading-relaxed text-smoke">
                the faint band behind each bar is uncertainty — a wide band means the agent has not
                tested that trait enough to trust its own number.
              </p>
            </div>
          </Panel>

          <Panel
            title="belief shift log"
            right="newest last"
            className="h-[340px] xl:h-auto xl:min-h-[220px] xl:flex-1"
          >
            <BeliefLog />
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** Derived entirely from consecutive agent states + the biggest miss per generation. */
function BeliefLog() {
  const agentStates = useStore((s) => s.agentStates)
  const experiments = useStore((s) => s.experiments)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)

  const rows = useMemo(() => {
    return agentStates.map((state, i) => {
      const prev = agentStates[i - 1]
      const shifts = prev
        ? BELIEF_TRAITS.map((t) => ({
            trait: t,
            from: prev.beliefs[t] ?? 0,
            to: state.beliefs[t] ?? 0,
            d: (state.beliefs[t] ?? 0) - (prev.beliefs[t] ?? 0),
          }))
            .filter((s) => Math.abs(s.d) >= 0.02)
            .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
            .slice(0, 4)
        : []

      // The experiment in the preceding generation whose result moved this state.
      const pool = experiments.filter(
        (e) => e.generation === state.generation - 1 && e.observed.fitness !== null,
      )
      const driver = pool.reduce<(typeof pool)[number] | null>((acc, e) => {
        const s = Math.abs((e.observed.fitness ?? 0) - e.prediction.fitness)
        const best = acc ? Math.abs((acc.observed.fitness ?? 0) - acc.prediction.fitness) : -1
        return s > best ? e : acc
      }, null)

      return { state, shifts, driver }
    })
  }, [agentStates, experiments])

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex flex-col gap-3">
        {rows.map(({ state, shifts, driver }) => (
          <div key={state.generation} className="border-l border-hairline pl-3">
            <div className="flex items-baseline gap-2">
              <span className="num text-2xs tracking-[0.14em] text-bone/70">
                [G{state.generation}]
              </span>
              {driver ? (
                <button
                  type="button"
                  onClick={() => {
                    select(driver.id)
                    setView('specimen')
                  }}
                  className="num text-2xs text-smoke underline decoration-dotted underline-offset-2 transition-colors hover:text-acid"
                  title="open this experiment"
                >
                  driver {driver.id.replace('exp_', '#')}{' '}
                  {delta((driver.observed.fitness ?? 0) - driver.prediction.fitness)}
                </button>
              ) : (
                <span className="text-2xs text-smoke">seeded from corpus</span>
              )}
            </div>

            {shifts.length ? (
              <div className="mt-1 flex flex-col gap-0.5">
                {shifts.map((s) => (
                  <div key={s.trait} className="flex items-baseline gap-2 text-2xs">
                    <span
                      className={cx('num w-3 shrink-0')}
                      style={{ color: s.d > 0 ? C.acid : C.rust }}
                    >
                      {s.d > 0 ? '↑' : '↓'}
                    </span>
                    <span className="w-[104px] shrink-0 truncate lowercase tracking-lab text-smoke">
                      {titleize(s.trait)}
                    </span>
                    <span className="num text-bone/70">
                      {fit(s.from)} → {fit(s.to)}
                    </span>
                    <span className="num ml-auto" style={{ color: s.d > 0 ? C.acid : C.rust }}>
                      {delta(s.d)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="mt-1.5 text-2xs leading-relaxed text-bone/55">{state.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
