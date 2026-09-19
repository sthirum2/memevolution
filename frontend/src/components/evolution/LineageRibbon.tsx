import type { Experiment } from '@/types'
import { effectiveFitness, scoreColor } from '@/lib/fitness'
import { cx } from '@/components/ui'

/**
 * The whole family tree at a glance, on one line, always fully visible.
 * One column per generation; one dot per meme; the filled dot is the winner
 * that became the parent of the next generation.
 */
export default function LineageRibbon({
  experiments,
  generations,
  selected,
  onSelect,
}: {
  experiments: Experiment[]
  generations: number[]
  selected: number
  onSelect: (gen: number) => void
}) {
  return (
    <div className="flex items-stretch gap-0.5 overflow-x-auto pb-1 sm:gap-1 sm:overflow-x-visible">
      {generations.map((gen, i) => {
        const rows = experiments
          .filter((e) => e.generation === gen)
          .sort((a, b) => a.id.localeCompare(b.id))
        const active = selected === gen
        return (
          <div key={gen} className="flex min-w-0 flex-1 items-stretch gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => onSelect(gen)}
              className={cx(
                'flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl border px-2 py-2.5 transition-all duration-200 sm:px-3',
                active
                  ? 'border-agent bg-agent-soft'
                  : 'border-transparent hover:border-line hover:bg-card',
              )}
            >
              <span className={cx('text-xs font-semibold', active ? 'text-agent' : 'text-muted')}>
                {gen === 0 ? 'Start' : `Gen ${gen}`}
              </span>
              <span className="flex items-center gap-1 sm:gap-1.5">
                {rows.map((e) => {
                  const winner = e.status === 'survived' || e.status === 'deployed'
                  return (
                    <span
                      key={e.id}
                      title={e.content.headline}
                      className={cx('rounded-full transition-all', winner ? 'h-3 w-3' : 'h-2 w-2')}
                      style={{
                        background: winner ? scoreColor(effectiveFitness(e)) : '#D6D3CB',
                      }}
                    />
                  )
                })}
              </span>
            </button>
            {i < generations.length - 1 ? (
              <span className="hidden shrink-0 items-center text-line sm:flex" aria-hidden>
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path
                    d="M0 5h11M8 1.5L11.5 5 8 8.5"
                    stroke="#D6D3CB"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
