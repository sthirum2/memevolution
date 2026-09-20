import type { Experiment } from '@/types'
import { C, STATUS, effectiveFitness, scoreColor, surprise, BIG_SURPRISE } from '@/lib/fitness'
import { PLATFORM_NAMES, plainFeature, plainTrait, score, titleCase } from '@/lib/plain'
import { Badge, Bar, Modal, Stat, cx } from '@/components/ui'
import MemePreview from './MemePreview'

const NUMERIC = ['absurdity', 'irony', 'relatability', 'trend_relevance'] as const
const CATEGORICAL = ['topic', 'humor', 'format', 'hook', 'audio_strategy'] as const

export default function MemeDetail({
  exp,
  parent,
  onClose,
  onOpenParent,
}: {
  exp: Experiment | null
  parent: Experiment | null
  onClose: () => void
  onOpenParent: (id: string) => void
}) {
  if (!exp) return null
  const status = STATUS[exp.status]
  const surp = surprise(exp)
  const big = surp !== null && Math.abs(surp) >= BIG_SURPRISE
  const f = effectiveFitness(exp)

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-bold">
            {exp.generation === 0 ? 'Starting point' : `Generation ${exp.generation}`}
          </span>
          <Badge tone={status.tone} dot={exp.status === 'deployed'}>
            {status.label}
          </Badge>
          {exp.deployment.platform ? (
            <Badge>{PLATFORM_NAMES[exp.deployment.platform]}</Badge>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* the meme itself */}
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <MemePreview content={exp.content} className="rounded-xl" />
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-xl font-bold leading-snug">{exp.content.headline}</h3>
            <p className="text-sm leading-relaxed text-muted">{exp.content.visual_description}</p>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Caption</dt>
                <dd className="font-medium">{exp.content.caption}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Sound</dt>
                <dd className="font-medium">{exp.content.audio}</dd>
              </div>
              {parent ? (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">Came from</dt>
                  <dd>
                    <button
                      type="button"
                      onClick={() => onOpenParent(parent.id)}
                      className="font-medium text-agent underline-offset-2 hover:underline"
                    >
                      {parent.content.headline}
                    </button>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        {/* the result */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-guess-soft p-4">
            <Stat
              label="AI predicted"
              value={exp.status === 'pending' ? '–' : (score(exp.prediction.fitness) ?? '–')}
              color={C.guess}
              size="sm"
              sub={
                exp.status === 'pending'
                  ? 'Not scored yet'
                  : Number.isFinite(exp.prediction.confidence)
                    ? `${Math.round(exp.prediction.confidence * 100)}% confident`
                    : 'Confidence not available'
              }
            />
          </div>
          <div
            className={cx(
              'rounded-xl p-4',
              exp.observed.fitness === null ? 'bg-paper' : 'bg-win-soft',
            )}
          >
            <Stat
              label="Actually got"
              value={score(exp.observed.fitness) ?? '–'}
              color={exp.observed.fitness === null ? C.muted : scoreColor(f)}
              size="sm"
              sub={
                exp.observed.fitness === null
                  ? exp.status === 'deployed'
                    ? 'Still counting'
                    : 'Never posted'
                  : `${(exp.observed.views ?? 0).toLocaleString()} views`
              }
            />
          </div>
          {surp !== null ? (
            <div className={cx('rounded-xl p-4', surp >= 0 ? 'bg-win-soft' : 'bg-dead-soft')}>
              <Stat
                label={big ? 'Big surprise' : 'Difference'}
                value={`${surp >= 0 ? '+' : '−'}${Math.abs(Math.round(surp * 100))}`}
                color={surp >= 0 ? C.win : C.dead}
                size="sm"
                sub={surp >= 0 ? 'Better than the AI thought' : 'Worse than the AI thought'}
              />
            </div>
          ) : null}
        </div>

        {/* why the AI tried it */}
        <div className="rounded-xl border-l-4 border-agent bg-agent-soft/60 px-4 py-3">
          <p className="label mb-1 text-agent">The AI&rsquo;s reasoning</p>
          <p className="text-sm leading-relaxed">{exp.hypothesis}</p>
        </div>

        {/* what changed */}
        {exp.mutations.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h4 className="font-display font-bold">What the AI changed from its parent</h4>
            <ul className="flex flex-col gap-1.5">
              {exp.mutations.map((m) => {
                const numeric = typeof m.from === 'number' && typeof m.to === 'number'
                const d = numeric ? (m.to as number) - (m.from as number) : null
                const fmt = (v: number | string) =>
                  typeof v === 'number'
                    ? Number.isInteger(v) && Math.abs(v) >= 1
                      ? String(v)
                      : String(Math.round(v * 100))
                    : titleCase(String(v))
                return (
                  <li
                    key={m.trait}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-paper px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{plainTrait(m.trait)}</span>
                    <span className="num text-muted">{fmt(m.from)}</span>
                    <span className="text-muted">→</span>
                    <span className="num font-semibold">{fmt(m.to)}</span>
                    {d !== null ? (
                      <span
                        className={cx(
                          'num ml-auto text-xs font-bold',
                          d > 0 ? 'text-win' : 'text-dead',
                        )}
                      >
                        {d > 0 ? 'more' : 'less'}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {/* traits */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2.5">
            <h4 className="font-display font-bold">Its traits</h4>
            {NUMERIC.map((t) => (
              <Bar
                key={t}
                label={plainTrait(t)}
                value={exp.genome[t]}
                color={exp.mutations.some((m) => m.trait === t) ? C.agent : '#C9C6BE'}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <h4 className="font-display font-bold">Its recipe</h4>
            <dl className="flex flex-col gap-1.5 text-sm">
              {CATEGORICAL.map((t) => (
                <div key={t} className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted">{plainTrait(t)}</dt>
                  <dd className="font-medium">{titleCase(String(exp.genome[t]))}</dd>
                </div>
              ))}
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted">Length</dt>
                <dd className="num font-medium">{exp.genome.video_length}s</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* real numbers */}
        {exp.observed.views !== null ? (
          <div className="flex flex-col gap-2">
            <h4 className="font-display font-bold">What really happened</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ['Views', exp.observed.views],
                  ['Likes', exp.observed.likes],
                  ['Comments', exp.observed.comments],
                  ['Shares', exp.observed.shares],
                  ['Saves', exp.observed.saves],
                ] as [string, number | null][]
              ).map(([k, v]) => (
                <div
                  key={k}
                  className={cx(
                    'rounded-xl p-3',
                    k === 'Shares' || k === 'Saves' ? 'bg-win-soft' : 'bg-paper',
                  )}
                >
                  <p className="text-xs text-muted">{k}</p>
                  <p className="num font-display text-lg font-bold">{v === null ? '?' : v.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Shares and saves count most towards the spread score — someone passing a meme on is
              the closest thing in the data to it actually reproducing.
            </p>
          </div>
        ) : null}

        {/* why the model liked it */}
        {exp.prediction.feature_attribution.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <h4 className="font-display font-bold">What drove the AI&rsquo;s prediction</h4>
            {exp.prediction.feature_attribution.map((a) => {
              const max = Math.max(
                0.1,
                ...exp.prediction.feature_attribution.map((x) => Math.abs(x.contribution)),
              )
              const w = (Math.abs(a.contribution) / max) * 50
              const pos = a.contribution >= 0
              return (
                <div key={a.feature} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate text-sm text-muted">
                    {plainFeature(a.feature)}
                  </span>
                  <span className="relative h-2.5 flex-1">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                    <span
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        left: pos ? '50%' : `${50 - w}%`,
                        width: `${w}%`,
                        background: pos ? C.win : C.dead,
                      }}
                    />
                  </span>
                  <span
                    className="num w-12 shrink-0 text-right text-sm font-semibold"
                    style={{ color: pos ? C.win : C.dead }}
                  >
                    {pos ? '+' : '−'}
                    {Math.abs(Math.round(a.contribution * 100))}
                  </span>
                </div>
              )
            })}
            <p className="text-xs text-muted">
              Green pushed the prediction up, red pulled it down.
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
