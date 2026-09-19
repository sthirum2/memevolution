import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { backendLabel, USE_MOCK } from '@/api/client'
import { C } from '@/lib/fitness'
import { fit } from '@/lib/format'
import Sparkline from './Sparkline'
import { cx, Dot } from '@/components/common/ui'
import type { ViewKey } from '@/types'

const VIEWS: { key: ViewKey; label: string; hint: string }[] = [
  { key: 'organism', label: 'organism', hint: '1' },
  { key: 'specimen', label: 'specimen', hint: '2' },
  { key: 'mind', label: 'mind', hint: '3' },
  { key: 'lab', label: 'lab', hint: '4' },
  { key: 'corpus', label: 'corpus', hint: '5' },
]

export default function TopBar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const generations = useStore((s) => s.generations)
  const experiments = useStore((s) => s.experiments)
  const toggleShortcuts = useStore((s) => s.toggleShortcuts)

  const meanSeries = useMemo(
    () => generations.map((g) => g.meanFitness).filter((n) => n > 0),
    [generations],
  )
  const currentGen = generations.length ? generations[generations.length - 1].generation : 0
  const trend =
    meanSeries.length >= 2
      ? meanSeries[meanSeries.length - 1] - meanSeries[meanSeries.length - 2]
      : 0

  return (
    <header className="relative z-30 flex shrink-0 flex-col border-b border-hairline bg-void/80 backdrop-blur-sm">
      <div className="flex items-center gap-5 px-4 py-2.5 xl:px-6">
        {/* wordmark */}
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="font-display text-sm font-bold tracking-[0.2em] text-bone">
            MEMEVOLUTION
          </span>
          <span className="hidden text-2xs tracking-lab text-smoke sm:inline">v0.1</span>
        </div>

        {/* the question, always on screen */}
        <p className="hidden min-w-0 flex-1 truncate text-2xs tracking-[0.06em] text-smoke lg:block">
          can an ai agent learn how culture spreads by participating in memetic evolution itself?
        </p>

        {/* vitals */}
        <div className="ml-auto flex shrink-0 items-center gap-4 xl:gap-6">
          <Vital label="gen" value={String(currentGen)} />
          <Vital label="experiments" value={String(experiments.length)} />
          <div className="hidden items-end gap-2 md:flex">
            <div className="flex flex-col gap-0.5">
              <span className="lab-label">mean fitness</span>
              <span className="num text-sm leading-none text-bone">
                {fit(meanSeries[meanSeries.length - 1] ?? 0)}
                <span className="ml-1 text-2xs" style={{ color: trend >= 0 ? C.acid : C.rust }}>
                  {trend >= 0 ? '▲' : '▼'}
                </span>
              </span>
            </div>
            <Sparkline values={meanSeries} color={trend >= 0 ? C.acid : C.rust} />
          </div>
          <div
            className="flex items-center gap-1.5"
            title={
              USE_MOCK
                ? 'Serving local mock data — nothing is posted anywhere'
                : 'Connected to the live backend'
            }
          >
            <Dot color={USE_MOCK ? C.probe : C.acid} pulse={!USE_MOCK} />
            <span className="text-2xs tracking-lab text-smoke">{backendLabel}</span>
          </div>
          <button
            type="button"
            onClick={toggleShortcuts}
            className="border border-hairline px-1.5 py-0.5 text-2xs text-smoke transition-colors hover:border-hairline-strong hover:text-bone"
            title="keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      {/* view tabs */}
      <nav className="flex items-center gap-0 overflow-x-auto px-4 xl:px-6">
        {VIEWS.map((v) => {
          const active = view === v.key
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cx(
                'group relative -mb-px border-b px-3 py-2 text-2xs lowercase tracking-lab transition-colors',
                active ? 'border-acid text-acid' : 'border-transparent text-smoke hover:text-bone',
              )}
            >
              {v.label}
              <span className="ml-1.5 opacity-40 group-hover:opacity-70">{v.hint}</span>
            </button>
          )
        })}
      </nav>
    </header>
  )
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="hidden flex-col gap-0.5 sm:flex">
      <span className="lab-label">{label}</span>
      <span className="num text-sm leading-none text-bone">{value}</span>
    </div>
  )
}
