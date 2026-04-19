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
    <div className="p-4 md:p-6 max-w-[1400px] overflow-x-hidden">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Activity</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">
            Audit log — most recent first{isPaged && ' — showing older events'}
          </p>
        </div>
        <div className="text-xs font-mono text-steel">{rows.length} events</div>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-steel border border-black/5 bg-white p-6 text-center rounded-card shadow-card">
          No activity yet. History begins when events are recorded.
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full md:min-w-[720px] text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-steel border-b border-black/5">
                  <th className="text-left px-3 py-2 font-medium font-mono">When</th>
                  <th className="text-left px-3 py-2 font-medium">Actor</th>
                  <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Event</th>
                  <th className="text-left px-3 py-2 font-medium">Summary</th>
                  <th className="text-right px-3 py-2 font-medium font-mono hidden md:table-cell">Link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-silicon/40 last:border-b-0 hover:bg-silicon/[0.22] ${i % 2 === 1 ? 'bg-silicon/[0.08]' : ''}`}>
                    <td className="px-3 py-2 font-mono text-steel" title={r.ts}>
                      {formatDistanceToNow(new Date(r.ts), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2 text-graphite">{r.actor}</td>
                    <td className="px-3 py-2 font-mono text-steel text-[11px] hidden md:table-cell">{r.eventType}</td>
                    <td className="px-3 py-2 text-steel">{r.summary}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">
                      {r.entityType === 'obligation' && r.entityId ? (
                        <Link href={`/obligations?id=${r.entityId}`} className="text-graphite hover:underline font-mono">
                          open →
                        </Link>
                      ) : (
                        <span className="text-steel/60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(nextPageQuery || isPaged) && (
        <div className="mt-4 flex items-center justify-between text-xs">
          {isPaged ? (
            <Link href="/activity" className="text-steel hover:text-graphite font-mono transition-colors">
              ← Back to recent
            </Link>
          ) : <span />}
          {nextPageQuery && (
            <Link
              href={`/activity${nextPageQuery}`}
              className="text-graphite hover:underline font-mono"
            >
              Load older events →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
