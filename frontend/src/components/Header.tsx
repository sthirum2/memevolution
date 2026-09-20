import { useStore } from '@/store/useStore'
import type { View } from '@/store/useStore'
import { cx } from '@/components/ui'

const TABS: { key: View; label: string }[] = [
  { key: 'evolution', label: 'The memes' },
  { key: 'lab', label: 'Try it' },
  { key: 'learned', label: 'What it learned' },
]

export default function Header() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-xl font-bold tracking-tight">Memevolution</h1>
          <p className="hidden text-sm text-muted md:block">
            An AI that posts memes, watches what happens, and gets better at it.
          </p>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={
                mode === 'live'
                  ? 'rounded-full bg-win-soft px-3 py-1 text-xs font-semibold text-win-deep'
                  : 'rounded-full bg-agent-soft px-3 py-1 text-xs font-semibold text-agent'
              }
            >
              {mode === 'live' ? 'Instagram · Real data' : 'Demo · Simulated engagement'}
            </span>
            <div className="flex rounded-full border border-line p-0.5" role="group" aria-label="Data mode">
              {(['live', 'demo'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors',
                    mode === m ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={cx(
                '-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors',
                view === t.key
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
