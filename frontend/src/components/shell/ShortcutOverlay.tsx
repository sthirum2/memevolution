import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { KeyCap, SectionLabel } from '@/components/common/ui'

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'views',
    rows: [
      ['1', 'the organism — evolution tree'],
      ['2', 'specimen — open the best experiment'],
      ['3', "the agent's mind — beliefs over time"],
      ['4', 'the lab — run a generation'],
      ['5', 'corpus — historical grounding'],
    ],
  },
  {
    title: 'actions',
    rows: [
      ['R', 'replay evolution from generation 0'],
      ['D', 'demo playback — run the whole pipeline'],
      ['L', 'collapse / expand the agent log'],
      ['Esc', 'close the specimen panel or this overlay'],
      ['?', 'this overlay'],
    ],
  },
]

export default function ShortcutOverlay() {
  const open = useStore((s) => s.shortcutsOpen)
  const toggle = useStore((s) => s.toggleShortcuts)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={toggle}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-void/80 p-6 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md border border-hairline-strong bg-carbon p-5"
          >
            <div className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-xs font-bold tracking-[0.2em]">SHORTCUTS</span>
              <span className="text-2xs tracking-lab text-smoke">esc to close</span>
            </div>
            <div className="flex flex-col gap-5">
              {GROUPS.map((g) => (
                <div key={g.title} className="flex flex-col gap-2">
                  <SectionLabel>{g.title}</SectionLabel>
                  {g.rows.map(([k, desc]) => (
                    <div key={k} className="flex items-center gap-3">
                      <KeyCap>{k}</KeyCap>
                      <span className="text-2xs text-bone/70">{desc}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
