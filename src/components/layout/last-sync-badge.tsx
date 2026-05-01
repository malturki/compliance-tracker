'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'

/**
 * Tiny "Synced N ago" pill rendered in the AppShell. Reads the most recent
 * audit-log timestamp via /api/sync-status and refreshes:
 *   - on a 60s poll (in case an agent or another tab mutated the DB)
 *   - on a 30s tick of the relative-time label (no fetch — just render)
 *
 * Hides itself silently when:
 *   - no audit events exist yet (fresh tracker)
 *   - the fetch fails (avoid noisy errors in the chrome)
 *   - the user is unauthenticated (the route returns 401)
 *
 * Anchored top-right with `position: fixed` so it appears regardless of which
 * page is active. The mobile hamburger lives at top-left, so the two don't
 * collide.
 */
export function LastSyncBadge() {
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // Single fetch helper — used on mount and on the 60s interval.
  const refresh = async () => {
    try {
      const res = await fetch('/api/sync-status')
      if (!res.ok) return
      const body = await res.json()
      if (typeof body.lastSyncAt === 'string') {
        setLastSyncAt(body.lastSyncAt)
      } else {
        setLastSyncAt(null)
      }
    } catch {
      // Silent — chrome shouldn't surface transient network errors.
    }
  }

  useEffect(() => {
    refresh()
    const fetchInterval = setInterval(refresh, 60_000)
    const tickInterval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => {
      clearInterval(fetchInterval)
      clearInterval(tickInterval)
    }
  }, [])

  if (!lastSyncAt) return null

  // `tick` is referenced so React re-renders on the 30s interval and the
  // relative label updates without a refetch. Suppress the unused-var warning
  // by reading it.
  void tick
  const relative = formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })
  const absolute = format(new Date(lastSyncAt), "EEE MMM d, yyyy 'at' h:mm a")

  return (
    <div
      className="fixed top-3 right-3 z-[55] hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/90 backdrop-blur border border-black/5 shadow-card text-[10px] font-mono text-steel hover:text-graphite transition-colors"
      title={`Last change: ${absolute}`}
      aria-label={`Last sync ${relative}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
      <span>Synced {relative}</span>
    </div>
  )
}
