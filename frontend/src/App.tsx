import { Suspense, lazy, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import Header from '@/components/Header'
import EvolutionView from '@/components/evolution/EvolutionView'
import LabView from '@/components/lab/LabView'
import { Button, Spinner } from '@/components/ui'

// The charting library is only needed on this screen, so it is not part of the
// first load — the two screens people open first stay light.
const LearnedView = lazy(() => import('@/components/learned/LearnedView'))

export default function App() {
  const init = useStore((s) => s.init)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const view = useStore((s) => s.view)

  useEffect(() => {
    void init()
  }, [init])

  // Switching tabs should start you at the top, not wherever the last tab was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view])

  if (loading) return <Loading />
  if (error) return <LoadError message={error} />

  return (
    <div className="min-h-full">
      <Header />
      <main>
        {view === 'evolution' ? <EvolutionView /> : null}
        {view === 'lab' ? <LabView /> : null}
        {view === 'learned' ? (
          <Suspense fallback={<Loading />}>
            <LearnedView />
          </Suspense>
        ) : null}
      </main>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner className="h-6 w-6" />
        <p className="text-sm font-medium">Loading the AI&rsquo;s memes…</p>
      </div>
    </div>
  )
}

function LoadError({ message }: { message: string }) {
  const init = useStore((s) => s.init)
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="card flex max-w-md flex-col gap-3 p-6">
        <h2 className="font-display text-lg font-bold text-dead">Could not load</h2>
        <p className="break-words text-sm text-muted">{message}</p>
        <p className="text-sm text-muted">
          If you are pointed at a live backend, check it is running. Otherwise set{' '}
          <code className="rounded bg-paper px-1 py-0.5 text-xs">VITE_USE_MOCK=true</code> in{' '}
          <code className="rounded bg-paper px-1 py-0.5 text-xs">.env</code>.
        </p>
        <Button onClick={() => void init()} className="self-start">
          Try again
        </Button>
      </div>
    </div>
  )
}
