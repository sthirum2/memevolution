import { useStore } from '@/store/useStore'
import { USE_MOCK } from '@/api/client'
import { Badge } from '@/components/ui'
import { fitnessText, isVideo } from '@/lib/evidence'
import { plainTrait } from '@/lib/plain'

export default function ExperimentOverview() {
  const { experiments, agentStates, lab, lastEvolution } = useStore()
  const latest = [...agentStates].sort((a, b) => b.generation - a.generation)[0]
  const chosen = lab.candidates.find((c) => c.id === lab.selection?.selectedId)
  const current = lab.posted ?? chosen
  const generation =
    current?.generation ??
    (experiments.length ? Math.max(...experiments.map((e) => e.generation)) : null)
  const stages = [
    [
      'Prediction',
      lab.candidates.length
        ? `${lab.candidates.filter((c) => Number.isFinite(c.prediction.fitness)).length} scored candidates`
        : 'Awaiting candidates',
    ],
    [
      'Deployment',
      lab.published
        ? lab.published.status === 'live'
          ? 'Published'
          : 'Awaiting TikTok confirmation'
        : 'Not deployed yet',
    ],
    ['Real engagement', lab.live ? 'Measurements received' : 'Awaiting engagement'],
    ['Learning', lab.evolveResult ? 'Beliefs updated' : 'Awaiting observation'],
    ['Evolution', lab.evolveResult ? 'Ready for next generation' : 'Next generation pending'],
  ]
  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6"
      aria-label="Experiment overview"
    >
      <div className="card overflow-hidden border-agent/30">
        <div className="flex flex-wrap items-start justify-between gap-4 bg-agent-soft/50 p-5">
          <div>
            <p className="label text-agent">The Memevolution experiment</p>
            <h2 className="mt-1 font-display text-2xl font-bold">
              Predict. Post. Observe. Evolve.
            </h2>
            <p className="mt-1 text-sm text-muted">
              Candidate genomes → model selection → concept → video → TikTok → engagement → next
              generation
            </p>
          </div>
          <Badge tone={USE_MOCK ? 'guess' : 'agent'}>
            {USE_MOCK ? 'Demo simulation' : 'Backend data'} ·{' '}
            {generation === null ? 'Generation pending' : `Generation ${generation}`}
          </Badge>
        </div>
        <p className="border-t border-line px-5 py-2 text-xs font-semibold text-muted">
          Current session
        </p>
        <ol className="grid gap-px bg-line sm:grid-cols-5">
          {stages.map(([label, status], index) => (
            <li key={label} className="bg-card p-4">
              <p className="font-display font-bold">
                {index + 1}. {USE_MOCK && label === 'Real engagement' ? 'Demo engagement' : label}
              </p>
              <p className="mt-1 text-sm text-muted">{status}</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-5 border-t border-line p-5 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Current agent strategy</h3>
            <p className="mt-1 text-sm text-muted">{latest?.note || 'Awaiting agent state'}</p>
            {lastEvolution ? (
              <p className="mt-2 text-sm font-semibold text-agent">
                Last observation: {lastEvolution.shifts.length} belief changes reported.
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(latest?.beliefs ?? {})
                .filter(([, value]) => Number.isFinite(value))
                .map(([trait, value]) => (
                  <span key={trait} className="rounded-lg bg-paper px-2.5 py-1.5 text-sm">
                    {plainTrait(trait)} <strong className="num">{value.toFixed(3)}</strong>
                  </span>
                ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Generation 1 → Generation 2</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[1, 2].map((gen) => {
                const rows = [
                  ...new Map(
                    [...experiments, ...(lab.posted ? [] : lab.candidates)].map((e) => [e.id, e]),
                  ).values(),
                ].filter((e) => e.generation === gen)
                const observed = rows.filter((e) => e.observed.fitness !== null)
                const best = observed.length
                  ? Math.max(...observed.map((e) => e.observed.fitness!))
                  : null
                return (
                  <div key={gen} className="rounded-xl bg-paper p-3">
                    <p className="font-bold">Gen {gen}</p>
                    <p className="text-sm">
                      {rows.length ? `${rows.length} candidates recorded` : 'Not generated yet'}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Best observed: <span className="num">{fitnessText(best)}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        {current ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line px-5 py-3 text-sm">
            <span>
              <strong>Selected:</strong> {current.id}
            </span>
            <span>
              <strong>Model:</strong>{' '}
              {USE_MOCK
                ? 'Demo scorer'
                : (current.prediction.model_version ?? 'Not reported by backend')}
            </span>
            <span>
              <strong>Video:</strong>{' '}
              {isVideo(current.content.media_url)
                ? 'Preview available'
                : 'Awaiting generated video'}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
