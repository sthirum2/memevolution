import { AnimatePresence, motion } from 'framer-motion'
import { Check, RotateCcw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { LabStage } from '@/store/useStore'
import { C } from '@/lib/fitness'
import { cx } from '@/components/common/ui'
import { StageAuthorize, StageGenerate, StageObserve, StageSeed, StageSelect } from './stages'

const STAGES: { key: LabStage; label: string; caption: string }[] = [
  { key: 'seed', label: 'seed', caption: 'pick the environment' },
  { key: 'generate', label: 'generate', caption: 'synthesise the population' },
  { key: 'select', label: 'select', caption: 'score and choose' },
  { key: 'authorize', label: 'authorize', caption: 'human in the loop' },
  { key: 'observe', label: 'observe', caption: 'measure and evolve' },
]

export default function LabView() {
  const lab = useStore((s) => s.lab)
  const setLab = useStore((s) => s.setLab)
  const resetLab = useStore((s) => s.resetLab)
  const demo = useStore((s) => s.demo)

  const currentIndex = STAGES.findIndex((s) => s.key === lab.stage)

  return (
    <div className="flex h-full min-h-0">
      {/* stage rail */}
      <nav className="hidden w-[196px] shrink-0 flex-col border-r border-hairline bg-carbon md:flex">
        <div className="flex items-baseline justify-between border-b border-hairline px-3 py-2">
          <span className="lab-label">pipeline</span>
          <button
            type="button"
            onClick={resetLab}
            title="reset the lab"
            className="text-smoke transition-colors hover:text-bone"
          >
            <RotateCcw size={11} />
          </button>
        </div>
        <div className="flex flex-col p-2">
          {STAGES.map((s, i) => {
            const done = i < currentIndex
            const active = i === currentIndex
            const reachable = i <= currentIndex
            return (
              <button
                key={s.key}
                type="button"
                disabled={!reachable}
                onClick={() => setLab({ stage: s.key })}
                className={cx(
                  'group relative flex items-start gap-2.5 px-2 py-2.5 text-left transition-colors',
                  reachable ? 'cursor-pointer' : 'cursor-not-allowed',
                )}
              >
                {/* connector */}
                {i < STAGES.length - 1 ? (
                  <span
                    className="absolute left-[15px] top-[26px] h-[22px] w-px transition-colors"
                    style={{ background: done ? C.acid : 'rgba(237,232,224,0.1)' }}
                  />
                ) : null}
                <span
                  className={cx(
                    'mt-px flex h-4 w-4 shrink-0 items-center justify-center border text-2xs transition-all',
                    active && 'animate-breathe',
                  )}
                  style={{
                    borderColor: done || active ? C.acid : 'rgba(237,232,224,0.14)',
                    background: done ? C.acid : 'transparent',
                    color: done ? C.void : active ? C.acid : C.smoke,
                  }}
                >
                  {done ? <Check size={9} strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cx(
                      'text-2xs lowercase tracking-lab transition-colors',
                      active ? 'text-acid' : done ? 'text-bone/70' : 'text-smoke',
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="text-2xs leading-tight text-smoke/70">{s.caption}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-auto border-t border-hairline p-3">
          <p className="text-2xs leading-relaxed text-smoke">
            one turn of the loop: learn → generate → select → deploy → observe → evolve.
          </p>
        </div>
      </nav>

      {/* stage body */}
      <div className="relative min-w-0 flex-1 overflow-y-auto">
        {demo ? (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-probe/40 bg-probe/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 animate-blink rounded-full bg-probe" />
            <span className="text-2xs lowercase tracking-lab text-probe">
              demo playback — running the pipeline hands-free on mock data
            </span>
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          <motion.div
            key={lab.stage}
            initial={{ opacity: 0, y: 8, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(5px)' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-5xl pb-32"
          >
            {lab.stage === 'seed' ? <StageSeed /> : null}
            {lab.stage === 'generate' ? <StageGenerate /> : null}
            {lab.stage === 'select' ? <StageSelect /> : null}
            {lab.stage === 'authorize' ? <StageAuthorize /> : null}
            {lab.stage === 'observe' ? <StageObserve /> : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
