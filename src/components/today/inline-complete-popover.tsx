'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Paperclip, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

interface Props {
  obligationId: string
  obligationTitle: string
  /** When true, disable submission until at least one URL or file is attached. */
  evidenceRequired?: boolean
  /** Called after a successful completion so the parent can update optimistically. */
  onCompleted: () => void
  /** Disabled state (e.g., for viewers). */
  disabled?: boolean
}

/**
 * Slim mark-complete popover anchored to a Today row's checkbox.
 * One-screen flow: optional summary + optional URL evidence + Done.
 * Defaults completedBy to the current session user; admin-style override is
 * available via the existing detail Sheet for the rare "complete on someone
 * else's behalf" case.
 */
export function InlineCompletePopover({
  obligationId,
  obligationTitle,
  evidenceRequired,
  onCompleted,
  disabled,
}: Props) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const summaryRef = useRef<HTMLTextAreaElement | null>(null)

  // Focus the summary box when the popover opens — ergonomic default for typing.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => summaryRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const reset = () => {
    setSummary('')
    setEvidenceUrl('')
  }

  const handleSubmit = async () => {
    if (evidenceRequired && !evidenceUrl.trim()) {
      toast.error('Evidence URL is required for this obligation')
      return
    }
    const completedBy = session?.user?.email
    if (!completedBy) {
      toast.error('No active session — sign in to mark complete')
      return
    }

    setSubmitting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const body = {
        completedBy,
        completedDate: today,
        summary: summary.trim() || null,
        ...(evidenceUrl.trim() ? { evidenceUrl: evidenceUrl.trim() } : {}),
      }
      const res = await fetch(`/api/obligations/${obligationId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to mark complete')
      }
      toast.success(`Marked done: ${obligationTitle}`)
      reset()
      setOpen(false)
      onCompleted()
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark complete')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={v => {
        if (disabled) return
        setOpen(v)
        if (!v) reset()
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        // Stop the click from bubbling to the row's <Link> wrapper, which
        // would otherwise open the full detail Sheet.
        onClick={e => e.stopPropagation()}
        className={`inline-flex items-center justify-center w-5 h-5 rounded border border-black/15 bg-white text-transparent hover:border-graphite hover:text-success transition-colors flex-shrink-0
          ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
        `}
        aria-label={`Mark ${obligationTitle} complete`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] bg-white border-black/5 shadow-card text-graphite"
        side="bottom"
        align="start"
        // Same — prevent any inner click from opening the row's link
        onClick={e => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] font-mono text-steel uppercase tracking-[0.18em]">Mark complete</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-steel hover:text-graphite -mt-0.5 -mr-1"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-graphite font-medium leading-tight line-clamp-2">{obligationTitle}</div>
          <div>
            <textarea
              ref={summaryRef}
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Summary (optional)"
              rows={2}
              className="w-full bg-canvas border border-black/5 text-graphite text-xs p-2 resize-none focus:outline-none focus:border-light-steel rounded"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-steel">
            <Paperclip className="w-3 h-3" />
            <span>Evidence URL{evidenceRequired ? ' (required)' : ' (optional)'}</span>
          </div>
          <input
            type="url"
            value={evidenceUrl}
            onChange={e => setEvidenceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-canvas border border-black/5 text-graphite text-xs px-2 py-1.5 focus:outline-none focus:border-light-steel rounded"
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-steel/70 font-mono truncate flex-1">
              by {session?.user?.email ?? 'you'}
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-graphite hover:bg-graphite/90 text-platinum text-xs h-7 gap-1.5"
            >
              {submitting ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Saving</>
              ) : (
                <><CheckCircle2 className="w-3 h-3" /> Done</>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
