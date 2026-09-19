import { useEffect, useState } from 'react'
import { getSnapshots, USE_MOCK } from '@/api/client'
import type { EngagementSnapshot } from '@/types'
import { countText } from '@/lib/evidence'
import { Button } from '@/components/ui'

export default function EngagementHistory({ id }: { id: string }) {
  const [rows, setRows] = useState<EngagementSnapshot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setRows([])
    setError(null)
    getSnapshots(id)
      .then((data) => {
        if (active) setRows([...data].sort((a, b) => a.timestamp.localeCompare(b.timestamp)))
      })
      .catch(() => {
        if (active) setError('Engagement history is not available. Try refreshing.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, revision])
  return (
    <section className="card p-5" aria-label="Engagement history">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">
            {USE_MOCK ? 'Demo engagement history' : 'Recorded engagement history'}
          </h3>
          <p className="text-sm text-muted">
            {USE_MOCK
              ? 'Simulated snapshots'
              : 'Snapshots returned by the backend; storage provider is not reported.'}
          </p>
        </div>
        <Button variant="secondary" disabled={loading} onClick={() => setRevision((n) => n + 1)}>
          Refresh history
        </Button>
      </div>
      {loading ? (
        <p role="status">Loading snapshots…</p>
      ) : error ? (
        <p role="status">{error}</p>
      ) : !rows.length ? (
        <p className="text-muted">Awaiting engagement snapshots</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Engagement measurements over time for {id}</caption>
            <thead>
              <tr>
                {['Time', 'Views', 'Likes', 'Comments', 'Shares', 'Saves'].map((label) => (
                  <th key={label} className="p-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.timestamp}-${i}`} className="border-t border-line">
                  <td className="whitespace-nowrap p-2">
                    {new Date(row.timestamp).toLocaleString()}
                  </td>
                  {(['views', 'likes', 'comments', 'shares', 'saves'] as const).map((key) => (
                    <td key={key} className="num p-2">
                      {countText(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
