'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

type AuditEvent = {
  id: string
  ts: string
  eventType: string
  actor: string
  summary: string
  diff: Record<string, [unknown, unknown]> | null
}

export function ObligationHistory({ obligationId }: { obligationId: string }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded || events !== null) return
    fetch(`/api/audit?entity=${encodeURIComponent(obligationId)}&limit=20`)
      .then(r => r.json())
      .then(data => setEvents(data.events))
      .catch(() => setEvents([]))
  }, [expanded, events, obligationId])

  const count = events?.length ?? null

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="text-slate-500 mb-2 uppercase tracking-wider text-[10px] flex items-center gap-1.5 hover:text-amber-400 transition-colors"
      >
        History {count !== null ? `(${count} events)` : ''} {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div className="space-y-1.5">
          {events === null ? (
            <div className="text-xs text-slate-500 font-mono">loading…</div>
          ) : events.length === 0 ? (
            <div className="text-xs text-slate-500 font-mono">no events</div>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="bg-[#0a0e1a] border border-[#1e2d47] p-2 text-xs">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-slate-500" title={ev.ts}>
                    {formatDistanceToNow(new Date(ev.ts), { addSuffix: true })}
                  </span>
                  <span className="text-slate-300">{ev.actor}</span>
                  <span className="font-mono text-amber-400">{ev.eventType}</span>
                </div>
                <div className="text-slate-400 mt-0.5">{ev.summary}</div>
                {ev.diff && (
                  <div className="text-slate-500 font-mono mt-1 space-y-0.5">
                    {Object.entries(ev.diff).map(([k, [b, a]]) => (
                      <div key={k}>
                        {k}: <span className="text-slate-400">{String(b)}</span> → <span className="text-slate-200">{String(a)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
