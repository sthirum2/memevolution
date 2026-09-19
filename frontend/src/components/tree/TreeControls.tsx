import { useReactFlow } from '@xyflow/react'
import { Maximize2, Minus, Play, Plus, RotateCcw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cx, StatusLegend } from '@/components/common/ui'

export default function TreeControls({ generations }: { generations: number[] }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const replay = useStore((s) => s.replay)
  const replaying = useStore((s) => s.replaying)
  const replayGen = useStore((s) => s.replayGen)
  const setReplayGen = useStore((s) => s.setReplayGen)

  return (
    <>
      {/* replay — the money shot */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-3">
        <button
          type="button"
          onClick={replay}
          disabled={replaying}
          className={cx(
            'group pointer-events-auto flex items-center gap-2 border px-3 py-2 text-2xs lowercase tracking-lab transition-all duration-200',
            replaying
              ? 'border-acid/40 text-acid/60'
              : 'border-acid/60 bg-void/70 text-acid backdrop-blur-sm hover:bg-acid hover:text-void',
          )}
        >
          {replaying ? <RotateCcw size={11} className="animate-spin" /> : <Play size={11} />}
          {replaying ? 'replaying…' : 'replay evolution'}
          {!replaying ? (
            <span className="opacity-40 transition-opacity group-hover:opacity-80">r</span>
          ) : null}
        </button>
        <div className="pointer-events-auto border border-hairline bg-void/70 px-3 py-2 backdrop-blur-sm">
          <StatusLegend />
        </div>
      </div>

      {/* zoom */}
      <div className="absolute right-4 top-4 z-20 flex flex-col border border-hairline bg-void/70 backdrop-blur-sm">
        {[
          { icon: <Plus size={12} />, fn: () => zoomIn({ duration: 220 }), title: 'zoom in' },
          { icon: <Minus size={12} />, fn: () => zoomOut({ duration: 220 }), title: 'zoom out' },
          {
            icon: <Maximize2 size={12} />,
            fn: () => fitView({ duration: 420, padding: 0.16 }),
            title: 'fit',
          },
        ].map((b, i) => (
          <button
            key={i}
            type="button"
            title={b.title}
            onClick={b.fn}
            className="border-b border-hairline p-2 text-smoke transition-colors last:border-b-0 hover:bg-graphite hover:text-bone"
          >
            {b.icon}
          </button>
        ))}
      </div>

      {/* generation scrubber */}
      <div className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-end gap-1 border border-hairline bg-void/70 p-2 backdrop-blur-sm md:flex">
        <span className="lab-label mb-1">generation</span>
        {generations.map((g) => {
          const active = replayGen === null || replayGen >= g
          const isCursor = replayGen === g
          return (
            <button
              key={g}
              type="button"
              onMouseEnter={() => setReplayGen(g)}
              onMouseLeave={() => setReplayGen(null)}
              onClick={() => setReplayGen(replayGen === g ? null : g)}
              className="group flex items-center gap-2"
              title={`isolate up to generation ${g}`}
            >
              <span
                className={cx(
                  'num text-2xs tabular-nums transition-colors',
                  isCursor ? 'text-acid' : active ? 'text-bone/70' : 'text-smoke/40',
                )}
              >
                {g}
              </span>
              <span
                className={cx(
                  'h-px transition-all duration-200',
                  isCursor ? 'w-7 bg-acid' : active ? 'w-4 bg-bone/40' : 'w-2 bg-smoke/30',
                )}
              />
            </button>
          )
        })}
      </div>
    </>
  )
}
