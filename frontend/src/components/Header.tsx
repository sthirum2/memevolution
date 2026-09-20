import { RotateCcw } from 'lucide-react'
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
  const demoMode = useStore((s) => s.demoMode)
  const toggleDemoMode = useStore((s) => s.toggleDemoMode)
  const resetAll = useStore((s) => s.resetAll)
  const loading = useStore((s) => s.loading)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-xl font-bold tracking-tight">Memevolution</h1>
          <p className="hidden text-sm text-muted md:block">
            An AI that posts memes, watches what happens, and gets better at it.
          </p>

          <div className="ml-auto flex items-center gap-2">
            {/* Reset button */}
            <button
              type="button"
              onClick={() => resetAll()}
              disabled={loading}
              title="Reset to a fresh round"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
            >
              <RotateCcw size={11} />
              Reset
            </button>

            {/* Demo / Live toggle */}
            <button
              type="button"
              onClick={toggleDemoMode}
              title={demoMode ? 'Switch to Live mode — real posts, real learning' : 'Switch to Demo mode — safe fake data for showing prospects'}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                demoMode
                  ? 'bg-guess-soft text-guess hover:bg-guess/20'
                  : 'bg-win-soft text-win-deep hover:bg-win/20',
              )}
            >
              {demoMode ? 'Demo data' : 'Live'} ↔ {demoMode ? 'Live' : 'Demo'}
            </button>
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
