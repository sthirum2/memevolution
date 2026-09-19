import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useDemo } from '@/lib/useDemo'
import { useKeyboard } from '@/lib/useKeyboard'
import GrainOverlay from '@/components/shell/GrainOverlay'
import TopBar from '@/components/shell/TopBar'
import AgentLog from '@/components/shell/AgentLog'
import ShortcutOverlay from '@/components/shell/ShortcutOverlay'
import OrganismView from '@/components/tree/OrganismView'
import SpecimenPanel from '@/components/panel/SpecimenPanel'
import MindView from '@/components/mind/MindView'
import LabView from '@/components/lab/LabView'
import CorpusView from '@/components/corpus/CorpusView'
import { Button } from '@/components/common/ui'

export default function App() {
  const init = useStore((s) => s.init)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const view = useStore((s) => s.view)
  const selectedId = useStore((s) => s.selectedId)

  const runDemo = useDemo()
  useKeyboard(runDemo)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-void">
      <GrainOverlay />
      <TopBar />

      <main className="relative z-10 flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {loading ? (
            <Booting />
          ) : error ? (
            <LoadError message={error} />
          ) : (
            <ViewSwitch view={view} />
          )}
        </div>

        {/* The specimen panel rides alongside the tree and the corpus, and is the
            whole content of the dedicated specimen view on narrow screens. */}
        {!loading && !error && selectedId && view !== 'lab' ? <SpecimenPanel /> : null}
      </main>

      <AgentLog />
      <ShortcutOverlay />
    </div>
  )
}

function ViewSwitch({ view }: { view: string }) {
  // The tree stays mounted: React Flow keeps its viewport, and returning to it
  // after a lab run does not re-run the entry animation.
  return (
    <>
      <div className={view === 'organism' || view === 'specimen' ? 'h-full w-full' : 'hidden'}>
        <OrganismView />
      </div>
      {view === 'mind' ? <MindView /> : null}
      {view === 'lab' ? <LabView /> : null}
      {view === 'corpus' ? <CorpusView /> : null}
    </>
  )
}

function Booting() {
  const log = useStore((s) => s.log)
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-4 px-6">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-sm font-bold tracking-[0.22em]">MEMEVOLUTION</span>
          <span className="animate-blink text-acid">_</span>
        </div>
        <div className="h-px w-full overflow-hidden bg-[rgba(237,232,224,0.08)]">
          <motion.div
            className="h-full bg-acid"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
        </div>
        <AnimatePresence>
          {log.slice(-3).map((l) => (
            <motion.p
              key={l.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xs text-smoke"
            >
              {l.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function LoadError({ message }: { message: string }) {
  const init = useStore((s) => s.init)
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col gap-3 border border-rust/40 bg-rust/[0.04] p-5">
        <span className="font-display text-xs font-bold tracking-[0.16em] text-rust">
          COULD NOT LOAD
        </span>
        <p className="break-words text-2xs leading-relaxed text-bone/75">{message}</p>
        <p className="text-2xs leading-relaxed text-smoke">
          if you are pointed at a live backend, check that it is running and that VITE_API_BASE_URL
          is correct — or set VITE_USE_MOCK=true in .env to fall back to local data.
        </p>
        <Button onClick={() => void init()} className="self-start">
          retry
        </Button>
      </div>
    </div>
  )
}
