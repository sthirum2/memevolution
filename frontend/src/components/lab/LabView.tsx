import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { Button, Spinner } from '@/components/ui'
import { score, plainTrait } from '@/lib/plain'
import { getCapabilities } from '@/api/http'
import PhonePreview from './PhonePreview'

const display = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? '?' : n.toLocaleString()

/**
 * run_generation builds GeminiConceptGenerator directly, which throws when no
 * API key (or Vertex project) is configured, so generating would fail with a
 * 503 after the user waits on it. Say so before they spend the click.
 */
function ConfigWarning() {
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let cancelled = false
    getCapabilities()
      .then(c => !cancelled && setMissing(!c.gemini))
      .catch(() => { /* advisory only; never block the flow on this */ })
    return () => { cancelled = true }
  }, [])
  if (!missing) return null
  return <div className="rounded-xl border border-dead bg-dead-soft p-4 text-sm">
    <strong>Gemini is not configured.</strong> Generating will fail until the backend can
    authenticate. Either set a <code>GEMINI_API_KEY</code> (starts with <code>AIzaSy</code>) in{' '}
    <code>backend/.env</code>, or for Vertex run <code>gcloud auth application-default login</code>.
    Restart the backend afterwards.
  </div>
}
export default function LabView() {
  const { lab, experiments, setLab, createMemes, prepare, postIt, refreshLive, finish, resetLab, resume } = useStore()
  const chosen = lab.candidates.find(e => e.id === lab.selection?.selectedId)
  const posted = lab.posted
  const saved = experiments.filter(e => e.selection?.selectedId === e.id)
  return <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
    <div><h2 className="font-display text-2xl font-bold">Run an Instagram experiment</h2>
      <p className="mt-2 text-muted">Generate strategies, review the selected image, then measure real engagement.</p></div>
    <p className="text-sm font-semibold text-agent">{lab.step === 'setup' ? '1 ? Choose a strategy' : lab.step === 'candidates' ? '2 ? Model selection' : lab.step === 'review' ? '3 ? Review and approve' : '4 ? Observe and learn'}</p>
    {lab.error && <div role="alert" className="rounded-xl border border-dead bg-dead-soft p-4">{lab.error}</div>}
    {lab.step === 'setup' && <>
      <ConfigWarning />
      <div className="card flex flex-col gap-4 p-6">
        <label className="font-semibold">Topic<input maxLength={100} value={lab.topic} onChange={e => setLab({ topic: e.target.value })} className="mt-2 block w-full rounded-xl border border-line p-3" /></label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={lab.adventurous} onChange={e => setLab({ adventurous: e.target.checked })} />Explore more (75% exploration; otherwise 20%)</label>
        <Button onClick={createMemes} disabled={lab.busy || !lab.topic.trim()}>{lab.busy && <Spinner />}Generate 5 strategies</Button>
        <p className="text-sm text-muted">XGBoost scores all five; Gemini writes the selected concept. Nothing is posted yet.</p>
      </div>
      {saved.length > 0 && <div className="card p-5"><h3 className="mb-3 font-bold">Continue a saved experiment</h3>
        <div className="flex flex-wrap gap-2">{saved.slice().reverse().map(e => <Button key={e.id} variant="secondary" onClick={() => resume(e.id)} disabled={lab.busy}>Generation {e.generation} ? {e.deployment.post_id ? 'Posted' : 'Draft'}</Button>)}</div>
      </div>}
    </>}
    {lab.step === 'candidates' && <>
      <div className="grid gap-3 sm:grid-cols-2">{lab.candidates.map(e => <div key={e.id} className={`card p-5 ${chosen?.id === e.id ? 'border-agent' : ''}`}>
        <p className="text-xs text-muted">{e.id}{chosen?.id === e.id ? ' ? Selected' : ''}</p>
        <h3 className="mt-2 font-bold">{e.content.headline}</h3><p className="my-2 text-sm">{e.hypothesis}</p>
        <p className="font-semibold">Predicted fitness: {display(score(e.prediction.fitness))}/100</p>
      </div>)}</div>
      <p>{lab.selection?.reasoning}</p>
      <Button onClick={prepare} disabled={lab.busy || !chosen}>{lab.busy && <Spinner />}Generate image for review</Button>
    </>}
    {lab.step === 'review' && chosen && <div className="grid gap-6 sm:grid-cols-2">
      <PhonePreview content={chosen.content} />
      <div className="card flex flex-col items-start gap-4 p-6">
        <h3 className="font-display text-xl font-bold">Approve this Instagram post</h3>
        <p>The image and caption shown here will be published to your connected Instagram account.</p>
        <p className="text-sm text-muted">Predicted fitness: {display(score(chosen.prediction.fitness))}/100. This score is not a probability or an engagement forecast.</p>
        <label className="flex gap-3"><input type="checkbox" checked={lab.approved} onChange={e => setLab({ approved: e.target.checked })} />I approve publishing this image and caption.</label>
        <Button variant="danger" onClick={postIt} disabled={!lab.approved || lab.busy}>{lab.busy && <Spinner />}Publish to Instagram</Button>
      </div>
    </div>}
    {lab.step === 'results' && posted && <>
      <div className="card flex flex-col gap-3 p-5">
        <h3 className="font-display text-xl font-bold">Published to Instagram</h3>
        <p className="text-sm">Media ID: {posted.deployment.post_id}</p>
        {posted.publish_result?.permalink && <a className="text-agent underline" href={posted.publish_result.permalink} target="_blank" rel="noreferrer">Open Instagram post</a>}
        <Button variant="secondary" onClick={refreshLive} disabled={lab.fetching || lab.busy}>{lab.fetching && <Spinner />}Fetch and save Instagram metrics</Button>
        <p className="text-sm text-muted">Missing metrics remain unavailable. Instagram insights can take time to arrive.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{(['views','likes','comments','shares','saves'] as const).map(k => <div className="card p-4" key={k}><p className="capitalize text-muted">{k}</p><strong className="text-2xl">{display(posted.observed[k])}</strong></div>)}</div>
      <div className="card p-5"><p>Predicted fitness: {display(score(posted.prediction.fitness))}/100</p><p>Observed fitness: {display(score(posted.observed.fitness))}/100</p></div>
      <div className="card overflow-auto p-5"><h3 className="mb-3 font-bold">Stored engagement history</h3>
        {posted.observed.timeseries.length ? <table className="w-full text-left text-sm"><thead><tr><th>Time</th><th>Views</th><th>Likes</th><th>Shares</th></tr></thead><tbody>{posted.observed.timeseries.map((p,i) => <tr key={`${p.t}-${i}`}><td>{new Date(p.t).toLocaleString()}</td><td>{display(p.views)}</td><td>{display(p.likes)}</td><td>{display(p.shares)}</td></tr>)}</tbody></table> : <p className="text-muted">No snapshots saved yet.</p>}
      </div>
      {lab.evolveResult ? <div className="card bg-win-soft p-5"><h3 className="font-bold">Observation applied</h3>
        {lab.evolveResult.shifts.length ? lab.evolveResult.shifts.map(s => <p key={s.trait}>{plainTrait(s.trait)}: {s.from.toFixed(3)} ? {s.to.toFixed(3)}</p>) : <p>The observation was recorded; no numeric belief changed.</p>}
      </div> : <Button onClick={finish} disabled={lab.busy || lab.fetching || posted.observed.fitness === null}>{lab.busy && <Spinner />}Update the agent from this observation</Button>}
    </>}
    {lab.step !== 'setup' && <Button variant="secondary" onClick={resetLab} disabled={lab.busy || lab.fetching}>Start another round</Button>}
  </div>
}
