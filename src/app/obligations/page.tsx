'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatDate, getDaysUntil, getRiskColor, getStatusColor, getCategoryLabel } from '@/lib/utils'
import type { Obligation, Completion, Category, Status, RiskLevel, Frequency } from '@/lib/types'
import { Search, ChevronUp, ChevronDown, X, Plus, CheckCircle, ChevronRight, FileText, ExternalLink, Download, Image as ImageIcon } from 'lucide-react'
import {
  isRecurringFrequency,
  isOneTimeFrequency,
  parseRecurrenceTab,
  parseRecurrenceCadence,
  type RecurrenceTab,
  type RecurrenceCadence,
} from '@/lib/recurrence'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { BulkActionBar } from '@/components/obligations/bulk-action-bar'
import { BulkCompleteDialog } from '@/components/obligations/bulk-complete-dialog'
import { BulkEditDialog } from '@/components/obligations/bulk-edit-dialog'
import { BulkDeleteDialog } from '@/components/obligations/bulk-delete-dialog'
import { ObligationHistory } from '@/components/ObligationHistory'

const CATEGORIES: Category[] = ['tax', 'investor', 'equity', 'state', 'federal', 'contract', 'insurance', 'benefits', 'governance', 'vendor']
const STATUSES: Status[] = ['overdue', 'upcoming', 'current', 'completed']
const RISK_LEVELS: RiskLevel[] = ['critical', 'high', 'medium', 'low']
const FREQUENCIES: Frequency[] = ['annual', 'quarterly', 'monthly', 'weekly', 'one-time', 'event-triggered']

type ObligationWithStatus = Obligation & { computedStatus: Status }

type SortField = 'title' | 'category' | 'frequency' | 'next_due_date' | 'owner' | 'risk_level'

function StatusBadge({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    overdue: 'OVERDUE', upcoming: 'UPCOMING', current: 'CURRENT',
    completed: 'DONE', blocked: 'BLOCKED', unknown: 'UNKNOWN', 'not-applicable': 'N/A',
  }
  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border ${getStatusColor(status)}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  )
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border ${getRiskColor(risk)}`}>
      {risk.toUpperCase()}
    </span>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-white border border-light-steel/60 text-graphite rounded">
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="text-steel hover:text-graphite -mr-0.5 p-0.5 rounded transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  )
}

// Inline editor for the counterparty field. Click "Edit" or the placeholder
// to switch into an input with autocomplete from existing counterparties; blur,
// Enter, or Save commits via PUT, Esc cancels. Viewers see a read-only row.
function CounterpartyEditor({
  obligationId,
  value,
  canEdit,
  onSaved,
}: {
  obligationId: string
  value: string | null | undefined
  canEdit: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  useEffect(() => {
    if (!editing) return
    fetch('/api/counterparties')
      .then(r => (r.ok ? r.json() : { counterparties: [] }))
      .then(d => setOptions((d.counterparties ?? []).map((c: any) => c.name)))
      .catch(() => {})
  }, [editing])

  const save = async () => {
    const next = draft.trim() || null
    if (next === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/obligations/${obligationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterparty: next }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Counterparty updated')
      setEditing(false)
      onSaved()
    } catch {
      toast.error('Failed to update counterparty')
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  if (!canEdit) {
    return (
      <div className="flex justify-between px-3 py-2">
        <span className="text-steel">Counterparty</span>
        <span className={`font-mono text-right ${value ? 'text-graphite' : 'text-steel/70'}`}>
          {value || '—'}
        </span>
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="flex justify-between items-center px-3 py-2">
        <span className="text-steel">Counterparty</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`font-mono text-right text-xs hover:text-graphite transition-colors ${value ? 'text-graphite' : 'text-steel/70 italic'}`}
          title="Click to edit"
        >
          {value || '— click to set'}
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <span className="text-steel">Counterparty</span>
      <div className="flex gap-1.5">
        <input
          type="text"
          list="counterparty-edit-options"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') cancel()
          }}
          autoFocus
          disabled={saving}
          placeholder="e.g. AWS, California FTB"
          className="flex-1 bg-white border border-black/5 text-graphite text-xs px-2 py-1 font-mono focus:outline-none focus:border-light-steel"
        />
        <datalist id="counterparty-edit-options">
          {options.map(o => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-[10px] font-mono bg-graphite text-platinum hover:bg-graphite/90 px-2 py-1 border border-light-steel disabled:opacity-50"
        >
          {saving ? '…' : 'save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="text-[10px] font-mono text-steel hover:text-graphite px-2 py-1 border border-black/5 disabled:opacity-50"
        >
          esc
        </button>
      </div>
    </div>
  )
}

function DetailPanel({
  item,
  onClose,
  onComplete,
  onUpdate,
  canEdit,
  subObligations,
  parentSummary,
  onSelectObligation,
}: {
  item: Obligation & { computedStatus: Status; completions?: Completion[] }
  onClose: () => void
  onComplete: () => void
  onUpdate: () => void
  canEdit: boolean
  subObligations: (Obligation & { computedStatus: Status })[]
  parentSummary: { id: string; title: string } | null
  onSelectObligation: (id: string) => void
}) {
  const [completing, setCompleting] = useState(false)
  const [completedBy, setCompletedBy] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleComplete = async () => {
    if (!completedBy.trim()) { toast.error('Enter your name'); return }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('completedBy', completedBy)
      formData.append('completedDate', new Date().toISOString().split('T')[0])
      formData.append('notes', completionNotes || '')

      // Add evidence URL if provided
      const urls: string[] = []
      if (evidenceUrl.trim()) {
        urls.push(evidenceUrl.trim())
      }
      formData.append('evidenceUrls', JSON.stringify(urls))

      // Add files
      evidenceFiles.forEach((file, idx) => {
        formData.append(`file_${idx}`, file)
      })

      const res = await fetch(`/api/obligations/${item.id}/complete`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to complete')
      }

      toast.success('Marked as complete')
      setCompleting(false)
      setEvidenceFiles([])
      setEvidenceUrl('')
      setCompletionNotes('')
      setCompletedBy('')
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark complete')
    } finally {
      setUploading(false)
    }
  }

  const days = getDaysUntil(item.nextDueDate)

  return (
    <div className="h-full flex flex-col">
      <SheetHeader className="px-5 pt-5 pb-4 border-b border-black/5">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="text-sm font-semibold text-graphite leading-tight pr-8">{item.title}</SheetTitle>
          <button onClick={onClose} className="text-steel hover:text-graphite flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={item.computedStatus} />
          <RiskBadge risk={item.riskLevel as RiskLevel} />
          <span className="text-xs font-mono text-steel">{getCategoryLabel(item.category)}</span>
        </div>
      </SheetHeader>

      {/* `min-h-0` lets flex-1 actually shrink inside a flex-col parent, and
          `overflow-y-auto` on a native div works reliably on iOS Safari (Base UI's
          ScrollArea uses a transformed viewport that sometimes eats touchmove
          events inside a Dialog). `overscroll-contain` keeps the outer page
          from rubber-banding when scrolling hits the sheet's edges. */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="px-5 py-4 pb-12 space-y-5 text-xs">
          {/* Hero: Next due date — most important info, largest text */}
          <div className={`border p-4 rounded-card ${
            item.computedStatus === 'overdue' ? 'bg-danger/10 border-danger/30'
            : item.computedStatus === 'upcoming' ? 'bg-warning/10 border-warning/30'
            : item.computedStatus === 'completed' ? 'bg-success/10 border-success/30'
            : 'bg-white border-black/5'
          }`}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-1">Next Due</div>
            <div className={`text-lg font-mono font-semibold ${
              item.computedStatus === 'overdue' ? 'text-danger'
              : item.computedStatus === 'upcoming' ? 'text-warning'
              : item.computedStatus === 'completed' ? 'text-success'
              : 'text-graphite'
            }`}>
              {formatDate(item.nextDueDate)}
            </div>
            <div className="text-[11px] text-steel font-mono mt-0.5">
              {item.computedStatus === 'completed' ? 'Completed — no recurrence' : days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`}
            </div>
          </div>

          {/* Parent breadcrumb (sub-obligation of a playbook-applied parent) */}
          {parentSummary && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-steel/70">Part of:</span>
              <button
                type="button"
                onClick={() => onSelectObligation(parentSummary.id)}
                className="text-graphite hover:underline truncate text-left"
              >
                {parentSummary.title} →
              </button>
            </div>
          )}

          {/* Blocker callout */}
          {(item as any).blockerReason && (
            <div className="bg-danger/10 border border-danger/30 rounded p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-danger mb-1">Blocked</div>
              <div className="text-xs text-graphite leading-relaxed break-words">
                {(item as any).blockerReason}
              </div>
            </div>
          )}

          {/* Next recommended action hint */}
          {(item as any).nextRecommendedAction && (
            <div className="bg-light-steel/[0.12] border border-light-steel/40 rounded p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-1">Next action</div>
              <div className="text-xs text-graphite leading-relaxed break-words">
                {(item as any).nextRecommendedAction}
              </div>
            </div>
          )}

          {/* Sub-obligation tree */}
          {subObligations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-steel uppercase tracking-[0.18em]">
                  Steps ({subObligations.filter(c => c.status === 'completed').length}/{subObligations.length} complete)
                </div>
              </div>
              <div className="bg-white border border-black/5 divide-y divide-silicon/40 rounded-card overflow-hidden">
                {subObligations.map((child, idx) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelectObligation(child.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-silicon/[0.18] transition-colors"
                  >
                    <div className="text-[10px] font-mono text-steel/70 w-5 text-right flex-shrink-0">
                      {idx + 1}.
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${child.status === 'completed' ? 'line-through text-steel' : 'text-graphite'} truncate`}>
                          {child.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-steel">
                        <span>{formatDate(child.nextDueDate)}</span>
                        <span>·</span>
                        <span>{child.owner}</span>
                      </div>
                    </div>
                    <StatusBadge status={child.status as Status} />
                    <ChevronRight className="w-3 h-3 text-steel/70 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <div className="text-[10px] text-steel uppercase tracking-[0.18em] mb-2">Schedule</div>
            <div className="bg-white border border-black/5 divide-y divide-silicon/40">
              <div className="flex justify-between px-3 py-2">
                <span className="text-steel">Frequency</span>
                <span className="font-mono text-graphite">{item.frequency}</span>
              </div>
              {item.lastCompletedDate && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-steel">Last Completed</span>
                  <span className="font-mono text-success">{formatDate(item.lastCompletedDate)}</span>
                </div>
              )}
              {item.alertDays && item.alertDays.length > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-steel">Alerts</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {item.alertDays.map(d => (
                      <span key={d} className="px-1.5 py-0.5 text-[10px] font-mono bg-silicon/40 text-steel rounded">{d}d</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div>
            <div className="text-[10px] text-steel uppercase tracking-[0.18em] mb-2">Assignment</div>
            <div className="bg-white border border-black/5 divide-y divide-silicon/40">
              <div className="flex justify-between px-3 py-2">
                <span className="text-steel">Owner</span>
                <span className="font-mono text-graphite text-right">{item.owner}</span>
              </div>
              {item.assignee && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-steel">Assignee</span>
                  <span className="font-mono text-graphite text-right">{item.assignee}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details — counterparty always shown (editable for editors+); other fields only when present */}
          <div>
            <div className="text-[10px] text-steel uppercase tracking-[0.18em] mb-2">Details</div>
            <div className="bg-white border border-black/5 divide-y divide-silicon/40">
              <CounterpartyEditor
                obligationId={item.id}
                value={item.counterparty}
                canEdit={canEdit}
                onSaved={onUpdate}
              />
              {item.jurisdiction && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-steel">Jurisdiction</span>
                  <span className="font-mono text-graphite text-right">{item.jurisdiction}</span>
                </div>
              )}
              {item.entity && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-steel">Entity</span>
                  <span className="font-mono text-graphite text-right">{item.entity}</span>
                </div>
              )}
              {item.amount != null && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-steel">Amount</span>
                  <span className="font-mono text-graphite text-right">${item.amount.toLocaleString()}</span>
                </div>
              )}
              {item.subcategory && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-steel">Subcategory</span>
                  <span className="font-mono text-graphite text-right">{item.subcategory}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <div>
              <div className="text-[10px] text-steel uppercase tracking-[0.18em] mb-2">Notes</div>
              <div className="text-graphite bg-white border border-black/5 p-3 leading-relaxed">
                {item.notes}
              </div>
            </div>
          )}

          {/* Completion history */}
          {item.completions && item.completions.length > 0 && (
            <div>
              <Separator className="mb-3 bg-silicon/40" />
              <div className="text-steel mb-2 uppercase tracking-[0.18em] text-[10px] flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3" /> Completion History
              </div>
              <div className="space-y-1.5">
                {item.completions.map(c => {
                  let evidenceUrls: string[] = []
                  if (c.evidenceUrl) {
                    if (Array.isArray(c.evidenceUrl)) {
                      evidenceUrls = c.evidenceUrl
                    } else if (typeof c.evidenceUrl === 'string') {
                      try {
                        const parsed = JSON.parse(c.evidenceUrl)
                        evidenceUrls = Array.isArray(parsed) ? parsed : [c.evidenceUrl]
                      } catch {
                        evidenceUrls = [c.evidenceUrl]
                      }
                    }
                  }

                  return (
                    <div key={c.id} className="bg-white border border-black/5 p-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-success">{formatDate(c.completedDate)}</span>
                        <span className="text-steel">{c.completedBy}</span>
                      </div>
                      {c.notes && <div className="text-steel mt-0.5">{c.notes}</div>}
                      {evidenceUrls.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-steel/70 text-[10px] uppercase tracking-[0.18em]">Evidence</div>
                          {evidenceUrls.map((url, idx) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                            const isPDF = /\.pdf$/i.test(url)
                            const isExternal = url.startsWith('http') && !url.includes('blob.vercel-storage.com')

                            return (
                              <div key={idx} className="flex items-center gap-2">
                                {isImage && (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img src={url} alt="Evidence" className="h-16 w-16 object-cover rounded border border-black/5 hover:border-light-steel transition-colors" />
                                  </a>
                                )}
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-graphite hover:text-graphite/80"
                                >
                                  {isExternal ? <ExternalLink className="w-3 h-3" /> : isPDF ? <FileText className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                  <span className="truncate">{isExternal ? 'External link' : url.split('/').pop()}</span>
                                </a>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Audit history */}
          <Separator className="bg-silicon/40" />
          <ObligationHistory obligationId={item.id} />

          {/* Mark complete */}
          {canEdit && (
            <>
          <Separator className="bg-silicon/40" />
          {completing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-steel">Completed by</Label>
                <Input
                  value={completedBy}
                  onChange={e => setCompletedBy(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 bg-white border-black/5 text-graphite text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-steel">Notes (optional)</Label>
                <textarea
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  placeholder="Additional details..."
                  rows={2}
                  className="mt-1 w-full bg-white border border-black/5 text-graphite text-xs p-2 resize-none focus:outline-none focus:border-light-steel"
                />
              </div>
              <div>
                <Label className="text-xs text-steel">Evidence (optional)</Label>
                <div className="mt-1 space-y-2">
                  <FileUpload
                    files={evidenceFiles}
                    onChange={setEvidenceFiles}
                    maxFiles={5}
                    maxSizeMB={25}
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-silicon/40" />
                    <span className="text-[10px] text-steel/70 uppercase tracking-[0.18em]">or</span>
                    <div className="h-px flex-1 bg-silicon/40" />
                  </div>
                  <Input
                    value={evidenceUrl}
                    onChange={e => setEvidenceUrl(e.target.value)}
                    placeholder="Paste link to document..."
                    className="bg-white border-black/5 text-graphite text-xs h-8"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={uploading}
                  className="bg-graphite hover:bg-graphite/90 text-platinum text-xs h-7 flex-1 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Confirm Complete'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCompleting(false)
                    setEvidenceFiles([])
                    setEvidenceUrl('')
                  }}
                  disabled={uploading}
                  className="border-black/5 text-steel text-xs h-7"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setCompleting(true)}
              className="w-full bg-graphite hover:bg-graphite/90 text-platinum text-xs h-8"
            >
              <CheckCircle className="w-3 h-3 mr-1.5" /> Mark Complete
            </Button>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AddObligationDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: '', category: 'tax' as Category, frequency: 'annual' as Frequency,
    nextDueDate: '', owner: '', riskLevel: 'medium' as RiskLevel,
    notes: '', counterparty: '', jurisdiction: '', subcategory: '', amount: '',
  })
  const [usersList, setUsersList] = useState<{ id: string; name: string | null; email: string }[]>([])
  const [counterpartyOptions, setCounterpartyOptions] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/users').then(r => r.ok ? r.json() : { users: [] }).then(d => setUsersList(d.users ?? [])).catch(() => {})
      fetch('/api/counterparties')
        .then(r => r.ok ? r.json() : { counterparties: [] })
        .then(d => setCounterpartyOptions((d.counterparties ?? []).map((c: any) => c.name)))
        .catch(() => {})
    }
  }, [open])

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title || !form.nextDueDate || !form.owner) {
      toast.error('Title, due date, and owner are required')
      return
    }
    try {
      const res = await fetch('/api/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          counterparty: form.counterparty.trim() || null,
          amount: form.amount ? parseFloat(form.amount) : null,
          alertDays: [],
          entity: 'Pi Squared Inc.',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Obligation added')
      onSave()
      onClose()
    } catch {
      toast.error('Failed to add obligation')
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-white border-black/5 text-graphite max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-graphite">Add Obligation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs text-steel">Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} className="mt-1 bg-white border-black/5 text-graphite text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-steel">Category *</Label>
              <Select value={form.category} onValueChange={v => v && set('category', v as Category)}>
                <SelectTrigger className="mt-1 bg-white border-black/5 text-graphite text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-black/5">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="text-graphite text-xs">{getCategoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-steel">Frequency *</Label>
              <Select value={form.frequency} onValueChange={v => v && set('frequency', v as Frequency)}>
                <SelectTrigger className="mt-1 bg-white border-black/5 text-graphite text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-black/5">
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f} value={f} className="text-graphite text-xs">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-steel">Next Due Date *</Label>
              <Input type="date" value={form.nextDueDate} onChange={e => set('nextDueDate', e.target.value)} className="mt-1 bg-white border-black/5 text-graphite text-xs" />
            </div>
            <div>
              <Label className="text-xs text-steel">Risk Level</Label>
              <Select value={form.riskLevel} onValueChange={v => v && set('riskLevel', v as RiskLevel)}>
                <SelectTrigger className="mt-1 bg-white border-black/5 text-graphite text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-black/5">
                  {RISK_LEVELS.map(r => (
                    <SelectItem key={r} value={r} className="text-graphite text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-steel">Owner *</Label>
            <Select value={form.owner} onValueChange={v => v && set('owner', v)}>
              <SelectTrigger className="mt-1 bg-white border-black/5 text-graphite text-xs h-9">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5">
                {usersList.map(u => (
                  <SelectItem key={u.id} value={u.name ?? u.email} className="text-graphite text-xs">{u.name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-steel">Counterparty</Label>
            <Input
              list="counterparty-options"
              value={form.counterparty}
              onChange={e => set('counterparty', e.target.value)}
              placeholder="e.g. AWS, California FTB, Republic Registered Agent"
              className="mt-1 bg-white border-black/5 text-graphite text-xs"
            />
            <datalist id="counterparty-options">
              {counterpartyOptions.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-steel">Jurisdiction</Label>
              <Input value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)} className="mt-1 bg-white border-black/5 text-graphite text-xs" />
            </div>
            <div>
              <Label className="text-xs text-steel">Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="mt-1 bg-white border-black/5 text-graphite text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-steel">Notes</Label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="mt-1 w-full bg-white border border-black/5 text-graphite text-xs p-2 resize-none focus:outline-none focus:border-light-steel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-black/5 text-steel text-xs">Cancel</Button>
          <Button onClick={handleSubmit} className="bg-graphite hover:bg-graphite/90 text-platinum text-xs">Add Obligation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ObligationsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const canEdit = session?.user?.role === 'editor' || session?.user?.role === 'admin'

  const [items, setItems] = useState<ObligationWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [riskLevel, setRiskLevel] = useState('')
  const [counterparty, setCounterparty] = useState(searchParams.get('counterparty') || '')
  const [counterpartyOptions, setCounterpartyOptions] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortField>('next_due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [activeTab, setActiveTab] = useState<RecurrenceTab>(parseRecurrenceTab(searchParams.get('tab')))
  const [recurringCadence, setRecurringCadence] = useState<RecurrenceCadence>(
    parseRecurrenceCadence(searchParams.get('cadence')),
  )
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'))
  const [selectedItem, setSelectedItem] = useState<(Obligation & { computedStatus: Status; completions?: Completion[] }) | null>(null)
  const [subObligations, setSubObligations] = useState<(Obligation & { computedStatus: Status })[]>([])
  const [parentSummary, setParentSummary] = useState<{ id: string; title: string } | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [showBulkComplete, setShowBulkComplete] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)

  const bulkMode = selectedIds.size > 0

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (status) params.set('status', status)
    if (riskLevel) params.set('risk_level', riskLevel)
    if (counterparty) params.set('counterparty', counterparty)
    if (search) params.set('search', search)
    params.set('sort_by', sortBy)
    params.set('sort_dir', sortDir)
    try {
      const res = await fetch(`/api/obligations?${params}`)
      const data = await res.json()
      setItems(data.map((d: any) => ({ ...d, computedStatus: d.status })))
    } finally {
      setLoading(false)
    }
  }, [category, status, riskLevel, counterparty, search, sortBy, sortDir])

  useEffect(() => {
    fetch('/api/counterparties')
      .then(r => r.ok ? r.json() : { counterparties: [] })
      .then(d => setCounterpartyOptions((d.counterparties ?? []).map((c: any) => c.name)))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null)
      setSubObligations([])
      setParentSummary(null)
      return
    }
    fetch(`/api/obligations/${selectedId}`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
      .then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status }))
      .catch(() => setSelectedItem(null))

    // Sub-obligation tree + parent breadcrumb for playbook-linked obligations.
    // Both are fire-and-forget: failures leave the sub-tree empty, which is
    // the correct UI for obligations without a tree.
    fetch(`/api/obligations/${selectedId}/sub-obligations`)
      .then(r => (r.ok ? r.json() : { children: [] }))
      .then((d: { children?: any[] }) => {
        const children = (d.children ?? []).map((c: any) => ({
          ...c,
          alertDays: c.alertDays || [],
          computedStatus: c.status,
        }))
        setSubObligations(children)
      })
      .catch(() => setSubObligations([]))
  }, [selectedId])

  // When the loaded obligation has a parent, fetch the parent's summary so
  // the breadcrumb can render.
  useEffect(() => {
    const parentId = (selectedItem as any)?.parentId as string | null | undefined
    if (!parentId) {
      setParentSummary(null)
      return
    }
    fetch(`/api/obligations/${parentId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setParentSummary(d ? { id: d.id, title: d.title } : null))
      .catch(() => setParentSummary(null))
  }, [selectedItem])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear selection
      if (e.key === 'Escape' && bulkMode) {
        setSelectedIds(new Set())
        setLastSelectedIndex(null)
      }
      // Ctrl/Cmd+A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !bulkMode) {
        e.preventDefault()
        setSelectedIds(new Set(displayedItems.map(i => i.id)))
        setLastSelectedIndex(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bulkMode, items])

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
  }

  const handleRowClick = (item: ObligationWithStatus, index: number, e: React.MouseEvent) => {
    if (bulkMode) {
      // In bulk mode, clicking toggles selection
      e.preventDefault()
      handleCheckboxChange(item.id, index, e)
    } else {
      // Normal mode, open detail panel
      setSelectedId(item.id === selectedId ? null : item.id)
    }
  }

  const handleCheckboxChange = (id: string, index: number, e: React.MouseEvent | React.ChangeEvent) => {
    const checked = selectedIds.has(id)

    if ('shiftKey' in e && e.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const newSelection = new Set(selectedIds)
      for (let i = start; i <= end; i++) {
        newSelection.add(items[i].id)
      }
      setSelectedIds(newSelection)
    } else {
      // Single toggle
      const newSelection = new Set(selectedIds)
      if (checked) {
        newSelection.delete(id)
      } else {
        newSelection.add(id)
      }
      setSelectedIds(newSelection)
      setLastSelectedIndex(index)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(displayedItems.map(i => i.id)))
    } else {
      setSelectedIds(new Set())
    }
    setLastSelectedIndex(null)
  }

  const handleBulkComplete = async (completedBy: string, notes: string) => {
    try {
      const res = await fetch('/api/obligations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-complete',
          ids: Array.from(selectedIds),
          data: { completedBy, completionNotes: notes },
        }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast.success(`Completed ${result.completed} obligation${result.completed > 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      setLastSelectedIndex(null)
      fetchItems()
    } catch {
      toast.error('Failed to complete obligations')
      throw new Error()
    }
  }

  const handleBulkEdit = async (field: 'owner' | 'risk', value: string, email?: string) => {
    try {
      const action = field === 'owner' ? 'update-owner' : 'update-risk'
      const data: any = field === 'owner'
        ? { owner: value, ownerEmail: email }
        : { riskLevel: value }

      const res = await fetch('/api/obligations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids: Array.from(selectedIds),
          data,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Updated ${selectedIds.size} obligation${selectedIds.size > 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      setLastSelectedIndex(null)
      fetchItems()
    } catch {
      toast.error('Failed to update obligations')
      throw new Error()
    }
  }

  const handleBulkDelete = async () => {
    try {
      const res = await fetch('/api/obligations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ids: Array.from(selectedIds),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Deleted ${selectedIds.size} obligation${selectedIds.size > 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      setLastSelectedIndex(null)
      fetchItems()
    } catch {
      toast.error('Failed to delete obligations')
      throw new Error()
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 text-steel/70" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-graphite" /> : <ChevronDown className="w-3 h-3 text-graphite" />
  }

  // Hide playbook sub-obligations from the main list — they live in the parent
  // detail Sheet, which already renders them as a tree (Phase 1).
  const topLevelItems = items.filter(i => !(i as any).parentId)
  const recurringItems = topLevelItems.filter(i => isRecurringFrequency(i.frequency))
  const oneTimeItems = topLevelItems.filter(i => isOneTimeFrequency(i.frequency))
  const tabCounts = {
    all: topLevelItems.length,
    recurring: recurringItems.length,
    onetime: oneTimeItems.length,
  }
  // Cadence sub-filter (only meaningful inside the Recurring tab).
  const cadenceCounts = {
    all: recurringItems.length,
    annual: recurringItems.filter(i => i.frequency === 'annual').length,
    quarterly: recurringItems.filter(i => i.frequency === 'quarterly').length,
    monthly: recurringItems.filter(i => i.frequency === 'monthly').length,
    weekly: recurringItems.filter(i => i.frequency === 'weekly').length,
  }
  const cadenceFilteredRecurring =
    recurringCadence === 'all'
      ? recurringItems
      : recurringItems.filter(i => i.frequency === recurringCadence)
  const displayedItems =
    activeTab === 'recurring' ? cadenceFilteredRecurring
    : activeTab === 'onetime' ? oneTimeItems
    : topLevelItems

  const allSelected = displayedItems.length > 0 && selectedIds.size === displayedItems.length

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-black/5 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-graphite">Obligations</h1>
            <p className="text-xs text-steel mt-0.5 font-mono">{displayedItems.length} obligations</p>
          </div>
          {!bulkMode && canEdit && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/templates')}
                className="border-black/5 text-graphite hover:text-graphite hover:bg-silicon/[0.18] text-xs h-7 gap-1.5"
              >
                <FileText className="w-3 h-3" /> Import Template
              </Button>
              <Button size="sm" onClick={() => setShowAdd(true)} className="bg-graphite hover:bg-graphite/90 text-platinum text-xs h-7 gap-1.5">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          )}
        </div>

        {/* Recurrence tabs — split top-level obligations by frequency cadence.
            Only shown when not in bulk-select mode. URL param `?tab=` makes the
            choice deep-linkable. */}
        {!bulkMode && (
          <div className="px-4 md:px-6 border-b border-black/5 flex gap-1 overflow-x-auto flex-shrink-0 bg-white">
            {([
              ['all', 'All', tabCounts.all],
              ['recurring', 'Recurring', tabCounts.recurring],
              ['onetime', 'One-time', tabCounts.onetime],
            ] as [RecurrenceTab, string, number][]).map(([key, label, count]) => {
              const active = activeTab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveTab(key)
                    setSelectedIds(new Set())
                    setLastSelectedIndex(null)
                    // Cadence sub-filter only applies inside Recurring; clear
                    // it when leaving so it doesn't leak into All / One-time.
                    if (key !== 'recurring') {
                      setRecurringCadence('all')
                    }
                    const params = new URLSearchParams(window.location.search)
                    if (key === 'all') params.delete('tab')
                    else params.set('tab', key)
                    if (key !== 'recurring') params.delete('cadence')
                    const qs = params.toString()
                    router.replace(qs ? `/obligations?${qs}` : '/obligations', { scroll: false })
                  }}
                  className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
                    active
                      ? 'text-graphite border-light-steel'
                      : 'text-steel border-transparent hover:text-graphite'
                  }`}
                >
                  {label}{' '}
                  <span className="text-[10px] font-mono text-steel/70">({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Cadence sub-filter — only visible inside the Recurring tab.
            URL param `?cadence=annual|quarterly|monthly|weekly` is deep-linkable. */}
        {!bulkMode && activeTab === 'recurring' && (
          <div className="px-4 md:px-6 py-2 border-b border-black/5 flex flex-wrap items-center gap-1.5 flex-shrink-0 bg-canvas">
            <span className="text-[10px] uppercase tracking-[0.18em] text-steel mr-1">Cadence:</span>
            {([
              ['all', 'All', cadenceCounts.all],
              ['annual', 'Annual', cadenceCounts.annual],
              ['quarterly', 'Quarterly', cadenceCounts.quarterly],
              ['monthly', 'Monthly', cadenceCounts.monthly],
              ['weekly', 'Weekly', cadenceCounts.weekly],
            ] as [RecurrenceCadence, string, number][]).map(([key, label, count]) => {
              const active = recurringCadence === key
              const empty = count === 0
              return (
                <button
                  key={key}
                  type="button"
                  disabled={empty && !active}
                  onClick={() => {
                    setRecurringCadence(key)
                    setSelectedIds(new Set())
                    setLastSelectedIndex(null)
                    const params = new URLSearchParams(window.location.search)
                    if (key === 'all') params.delete('cadence')
                    else params.set('cadence', key)
                    const qs = params.toString()
                    router.replace(qs ? `/obligations?${qs}` : '/obligations', { scroll: false })
                  }}
                  className={`text-[11px] font-mono px-2 py-0.5 border rounded transition-colors ${
                    active
                      ? 'bg-light-steel/[0.28] border-light-steel text-graphite'
                      : empty
                      ? 'bg-white border-black/5 text-steel/40 cursor-not-allowed'
                      : 'bg-white border-black/10 text-steel hover:text-graphite'
                  }`}
                >
                  {label}{' '}
                  <span className={`text-[10px] ${active ? 'text-steel' : 'text-steel/70'}`}>({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Bulk action bar or filters */}
        {canEdit && bulkMode ? (
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClear={() => {
              setSelectedIds(new Set())
              setLastSelectedIndex(null)
            }}
            onMarkComplete={() => setShowBulkComplete(true)}
            onEdit={() => setShowBulkEdit(true)}
            onDelete={() => setShowBulkDelete(true)}
          />
        ) : (
          <div className="px-4 md:px-6 py-3 border-b border-black/5 flex flex-wrap items-center gap-3 flex-shrink-0 bg-white">
            <div className="relative flex-shrink-0 w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-steel" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 bg-white border-black/5 text-graphite text-xs h-7 placeholder:text-steel/70"
              />
            </div>
            <Select value={category || 'all'} onValueChange={v => v && setCategory(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36 bg-white border-black/5 text-graphite text-xs h-7">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5">
                <SelectItem value="all" className="text-graphite text-xs">All Categories</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="text-graphite text-xs">{getCategoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={v => v && setStatus(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-32 bg-white border-black/5 text-graphite text-xs h-7">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5">
                <SelectItem value="all" className="text-graphite text-xs">All Status</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s} className="text-graphite text-xs capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskLevel || 'all'} onValueChange={v => v && setRiskLevel(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-28 bg-white border-black/5 text-graphite text-xs h-7">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5">
                <SelectItem value="all" className="text-graphite text-xs">All Risk</SelectItem>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r} value={r} className="text-graphite text-xs capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={counterparty || 'all'} onValueChange={v => v && setCounterparty(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44 bg-white border-black/5 text-graphite text-xs h-7">
                <SelectValue placeholder="Counterparty" />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5 max-h-72 overflow-y-auto">
                <SelectItem value="all" className="text-graphite text-xs">All Counterparties</SelectItem>
                {counterpartyOptions.map(name => (
                  <SelectItem key={name} value={name} className="text-graphite text-xs">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(category || status || riskLevel || counterparty || search) && (
              <button
                onClick={() => { setCategory(''); setStatus(''); setRiskLevel(''); setCounterparty(''); setSearch('') }}
                className="text-xs text-steel hover:text-graphite flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}

        {/* Active filter chips — one-click removal for each active filter.
            Stays visible while scrolling down large lists. */}
        {!bulkMode && (category || status || riskLevel || counterparty || search) && (
          <div className="px-4 md:px-6 py-2 border-b border-black/5 bg-canvas flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-steel mr-1">Active:</span>
            {search && (
              <FilterChip label={`Search: "${search}"`} onRemove={() => setSearch('')} />
            )}
            {category && (
              <FilterChip label={`Category: ${getCategoryLabel(category)}`} onRemove={() => setCategory('')} />
            )}
            {status && (
              <FilterChip label={`Status: ${status}`} onRemove={() => setStatus('')} />
            )}
            {riskLevel && (
              <FilterChip label={`Risk: ${riskLevel}`} onRemove={() => setRiskLevel('')} />
            )}
            {counterparty && (
              <FilterChip label={`Counterparty: ${counterparty}`} onRemove={() => setCounterparty('')} />
            )}
            <span className="text-[10px] text-steel/70 font-mono ml-1">{displayedItems.length} result{displayedItems.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {/* min-w keeps columns legible on narrow viewports;
              the wrapper's overflow-auto provides horizontal scroll.
              On mobile (<md) we hide Freq/Owner/Chevron columns and drop min-w
              so the table fits without horizontal scroll at 375px. */}
          <table className="w-full md:min-w-[900px] text-xs">
            <thead className="sticky top-0 bg-white border-b border-black/5 z-10">
              <tr>
                {canEdit && (
                <th className="px-3 py-2.5 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className="border-silicon"
                  />
                </th>
                )}
                {([
                  ['title', 'Obligation', 'text-left', ''],
                  ['category', 'Category', 'text-left', ''],
                  ['frequency', 'Freq', 'text-left', 'hidden md:table-cell'],
                  ['next_due_date', 'Due Date', 'text-right', ''],
                  ['owner', 'Owner', 'text-left', 'hidden md:table-cell'],
                ] as [SortField, string, string, string][]).map(([field, label, align, responsive]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`px-3 py-2.5 font-medium text-steel cursor-pointer hover:text-graphite select-none ${align} ${responsive}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium text-steel text-center">Status</th>
                <th
                  onClick={() => handleSort('risk_level')}
                  className="px-3 py-2.5 font-medium text-steel cursor-pointer hover:text-graphite text-center"
                >
                  <span className="inline-flex items-center gap-1">Risk <SortIcon field="risk_level" /></span>
                </th>
                {!bulkMode && <th className="w-6 hidden md:table-cell" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b border-silicon/40 animate-pulse">
                    <td className="px-3 py-3"><div className="h-3 w-4 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-48 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-16 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3 hidden md:table-cell"><div className="h-3 w-16 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-14 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3 hidden md:table-cell"><div className="h-3 w-20 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-20 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-12 bg-silicon/60 rounded" /></td>
                    <td className="px-3 py-3 hidden md:table-cell"><div className="h-3 w-10 bg-silicon/60 rounded" /></td>
                  </tr>
                ))
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center">
                    {(category || status || riskLevel || search || activeTab !== 'all') ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-sm text-steel">
                          No {activeTab === 'recurring' ? 'recurring ' : activeTab === 'onetime' ? 'one-time ' : ''}obligations match these filters
                        </div>
                        <button
                          onClick={() => {
                            setCategory('')
                            setStatus('')
                            setRiskLevel('')
                            setSearch('')
                          }}
                          className="mt-1 px-3 py-1.5 text-xs text-graphite hover:text-graphite/80 border border-light-steel hover:border-light-steel rounded transition-colors"
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-steel">No obligations found</div>
                    )}
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, i) => {
                  const days = getDaysUntil(item.nextDueDate)
                  const isSelected = bulkMode ? selectedIds.has(item.id) : selectedId === item.id
                  return (
                    <tr
                      key={item.id}
                      onClick={(e) => !bulkMode && handleRowClick(item, i, e)}
                      className={`border-b border-silicon/40 cursor-pointer transition-colors
                        ${isSelected && !bulkMode ? 'bg-light-steel/[0.12] border-l-2 border-l-light-steel' : ''}
                        ${isSelected && bulkMode ? 'bg-light-steel/[0.12]' : ''}
                        ${!isSelected && (i % 2 === 0 ? 'hover:bg-silicon/[0.18]' : 'bg-white hover:bg-silicon/[0.18]')}
                        ${item.computedStatus === 'overdue' ? 'bg-danger/[0.07] hover:bg-danger/[0.12]' : ''}
                      `}
                    >
                      {canEdit && (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => handleCheckboxChange(item.id, i, new MouseEvent('click') as any)}
                          onClick={(e) => handleCheckboxChange(item.id, i, e)}
                          className="border-silicon"
                        />
                      </td>
                      )}
                      <td className="px-3 py-2 max-w-[280px] break-words">
                        <span className={`font-medium leading-tight ${item.computedStatus === 'overdue' ? 'text-danger' : 'text-graphite'}`}>
                          {item.title}
                        </span>
                        {item.jurisdiction && <span className="text-steel/70 ml-1.5 text-[10px]">{item.jurisdiction}</span>}
                        {item.counterparty && (
                          <div className="text-[10px] text-steel mt-0.5 truncate">→ {item.counterparty}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-steel">{getCategoryLabel(item.category)}</td>
                      <td className="px-3 py-2 text-steel capitalize hidden md:table-cell">{item.frequency}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={item.computedStatus === 'overdue' ? 'text-danger' : item.computedStatus === 'upcoming' ? 'text-warning' : 'text-steel'}>
                          {formatDate(item.nextDueDate)}
                        </span>
                        <span className="text-steel/70 ml-1.5 text-[10px]">
                          {days === 0 ? 'today' : days > 0 ? `+${days}d` : `${days}d`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-steel max-w-[140px] truncate hidden md:table-cell">{item.owner}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={item.computedStatus} /></td>
                      <td className="px-3 py-2 text-center"><RiskBadge risk={item.riskLevel as RiskLevel} /></td>
                      {!bulkMode && <td className="px-2 py-2 text-steel/70 hidden md:table-cell"><ChevronRight className="w-3 h-3" /></td>}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      <Sheet open={!!selectedId && !!selectedItem && !bulkMode} onOpenChange={open => !open && setSelectedId(null)}>
        <SheetContent
          side="right"
          // Mobile: fill the viewport. Desktop: fixed 420px right drawer.
          className="w-full sm:w-[420px] sm:max-w-[420px] p-0 bg-white border-l border-black/5 text-graphite"
        >
          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              onClose={() => setSelectedId(null)}
              onComplete={() => {
                fetchItems()
                if (selectedId) {
                  fetch(`/api/obligations/${selectedId}`)
                    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
                    .then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status }))
                    .catch(() => setSelectedId(null))
                  fetch(`/api/obligations/${selectedId}/sub-obligations`)
                    .then(r => (r.ok ? r.json() : { children: [] }))
                    .then(d => setSubObligations((d.children ?? []).map((c: any) => ({ ...c, alertDays: c.alertDays || [], computedStatus: c.status }))))
                    .catch(() => {})
                }
              }}
              onUpdate={() => {
                fetchItems()
                if (selectedId) {
                  fetch(`/api/obligations/${selectedId}`)
                    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
                    .then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status }))
                    .catch(() => {})
                }
              }}
              canEdit={canEdit}
              subObligations={subObligations}
              parentSummary={parentSummary}
              onSelectObligation={id => setSelectedId(id)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AddObligationDialog open={showAdd} onClose={() => setShowAdd(false)} onSave={fetchItems} />

      {/* Bulk dialogs */}
      <BulkCompleteDialog
        open={showBulkComplete}
        selectedCount={selectedIds.size}
        onClose={() => setShowBulkComplete(false)}
        onComplete={handleBulkComplete}
      />
      <BulkEditDialog
        open={showBulkEdit}
        selectedCount={selectedIds.size}
        onClose={() => setShowBulkEdit(false)}
        onUpdate={handleBulkEdit}
      />
      <BulkDeleteDialog
        open={showBulkDelete}
        selectedCount={selectedIds.size}
        onClose={() => setShowBulkDelete(false)}
        onDelete={handleBulkDelete}
      />
    </div>
  )
}

export default function ObligationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-steel">Loading...</div>}>
      <ObligationsPageContent />
    </Suspense>
  )
}
