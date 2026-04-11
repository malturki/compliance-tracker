import { db, dbReady } from '@/db'
import { auditLog } from '@/db/schema'
import { and, desc, eq, lt, type SQL } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SearchParams = { type?: string; actor?: string; entity?: string; before?: string }

async function fetchEvents(params: SearchParams) {
  await dbReady
  const clauses: SQL[] = []
  if (params.type) clauses.push(eq(auditLog.eventType, params.type))
  if (params.actor) clauses.push(eq(auditLog.actor, params.actor))
  if (params.entity) clauses.push(eq(auditLog.entityId, params.entity))
  if (params.before) clauses.push(lt(auditLog.ts, params.before))
  return db
    .select()
    .from(auditLog)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(auditLog.ts))
    .limit(50)
}

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  const rows = await fetchEvents(searchParams)
  const hasMore = rows.length === 50
  const oldestTs = rows.length > 0 ? rows[rows.length - 1].ts : null
  const nextPageQuery = hasMore && oldestTs
    ? `?before=${encodeURIComponent(oldestTs)}${searchParams.type ? `&type=${searchParams.type}` : ''}${searchParams.actor ? `&actor=${searchParams.actor}` : ''}${searchParams.entity ? `&entity=${searchParams.entity}` : ''}`
    : null
  const isPaged = !!searchParams.before

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Activity</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            Audit log — most recent first{isPaged && ' — showing older events'}
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500">{rows.length} events</div>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-slate-500 border border-[#1e2d47] bg-[#0f1629] p-6 text-center">
          No activity yet. History begins when events are recorded.
        </div>
      ) : (
        <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47] text-slate-500">
                <th className="text-left px-3 py-2 font-medium font-mono">When</th>
                <th className="text-left px-3 py-2 font-medium">Actor</th>
                <th className="text-left px-3 py-2 font-medium">Event</th>
                <th className="text-left px-3 py-2 font-medium">Summary</th>
                <th className="text-right px-3 py-2 font-medium font-mono">Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={`border-b border-[#1e2d47]/50 ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                  <td className="px-3 py-2 font-mono text-slate-500" title={r.ts}>
                    {formatDistanceToNow(new Date(r.ts), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{r.actor}</td>
                  <td className="px-3 py-2 font-mono text-amber-400">{r.eventType}</td>
                  <td className="px-3 py-2 text-slate-400">{r.summary}</td>
                  <td className="px-3 py-2 text-right">
                    {r.entityType === 'obligation' && r.entityId ? (
                      <Link href={`/obligations?id=${r.entityId}`} className="text-amber-400 hover:underline font-mono">
                        open →
                      </Link>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(nextPageQuery || isPaged) && (
        <div className="mt-4 flex items-center justify-between text-xs">
          {isPaged ? (
            <Link href="/activity" className="text-slate-500 hover:text-amber-400 font-mono transition-colors">
              ← Back to recent
            </Link>
          ) : <span />}
          {nextPageQuery && (
            <Link
              href={`/activity${nextPageQuery}`}
              className="px-3 py-1.5 border border-[#1e2d47] hover:border-amber-500/50 text-slate-400 hover:text-amber-400 rounded transition-colors font-mono"
            >
              Load older events →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
