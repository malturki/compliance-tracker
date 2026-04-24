'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Sparkles, Loader2, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatDate, getCategoryLabel, getRiskColor } from '@/lib/utils'

interface PlaybookListItem {
  id: string
  name: string
  description: string
  category: string
  icon: string
  anchorDateStrategy: 'end-of-quarter' | 'provided-at-apply'
  recurrence: 'quarterly' | 'annual' | 'monthly' | null
  requiresCounterparty: boolean
  stepCount: number
}

interface PlaybookStep {
  slug: string
  title: string
  description?: string
  defaultOwner: string
  offsetDaysFromAnchor: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  evidenceRequired: boolean
  alertDays?: number[]
}

interface PlaybookDetail extends PlaybookListItem {
  parentTemplate: { title: string; description?: string; jurisdiction?: string }
  steps: PlaybookStep[]
}

/** End-of-quarter date for `ref`, in YYYY-MM-DD. Mirrors server logic. */
function endOfQuarterISO(ref: Date): string {
  const q = Math.floor(ref.getUTCMonth() / 3)
  const month = q * 3 + 3
  return new Date(Date.UTC(ref.getUTCFullYear(), month, 0)).toISOString().slice(0, 10)
}

function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function quarterLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
}

function resolveTitle(template: string, counterparty: string, anchorDate: string): string {
  const d = new Date(anchorDate + 'T00:00:00Z')
  return template
    .replace(/\{\{counterparty\}\}/g, counterparty || '—')
    .replace(/\{\{quarter\}\}/g, `Q${Math.floor(d.getUTCMonth() / 3) + 1}`)
    .replace(/\{\{year\}\}/g, String(d.getUTCFullYear()))
    .trim()
}

export default function PlaybooksPage() {
  const router = useRouter()
  const [list, setList] = useState<PlaybookListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PlaybookDetail | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [counterparty, setCounterparty] = useState('')
  const [anchorDate, setAnchorDate] = useState('')
  const [counterpartyOptions, setCounterpartyOptions] = useState<string[]>([])
  const [ownerOverrides, setOwnerOverrides] = useState<Record<string, string>>({})
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const loadPlaybooks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/playbooks')
      if (!res.ok) throw new Error('Failed to load playbooks')
      const data = await res.json()
      setList(data.playbooks)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load playbooks', {
        action: { label: 'Retry', onClick: loadPlaybooks },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlaybooks()
    fetch('/api/counterparties')
      .then(r => (r.ok ? r.json() : { counterparties: [] }))
      .then(d =>
        setCounterpartyOptions(
          Array.isArray(d?.counterparties)
            ? d.counterparties.map((c: any) => c.name).filter(Boolean)
            : [],
        ),
      )
      .catch(() => setCounterpartyOptions([]))
  }, [])

  const openPreview = async (id: string) => {
    const res = await fetch(`/api/playbooks/${id}`)
    if (!res.ok) {
      toast.error('Failed to load playbook detail')
      return
    }
    const detail: PlaybookDetail = await res.json()
    setSelected(detail)
    setCounterparty('')
    setOwnerOverrides({})
    setAdvancedOpen(false)
    // Default anchor: end-of-current-quarter for end-of-quarter strategy;
    // today-end-of-quarter is still a reasonable starting point for manual.
    const defaultAnchor =
      detail.anchorDateStrategy === 'end-of-quarter'
        ? endOfQuarterISO(new Date())
        : new Date().toISOString().slice(0, 10)
    setAnchorDate(defaultAnchor)
    setPreviewOpen(true)
  }

  const previewedTitle = useMemo(() => {
    if (!selected || !anchorDate) return ''
    return resolveTitle(selected.parentTemplate.title, counterparty.trim(), anchorDate)
  }, [selected, anchorDate, counterparty])

  const canApply = useMemo(() => {
    if (!selected) return false
    if (selected.stepCount === 0) return false
    if (selected.requiresCounterparty && !counterparty.trim()) return false
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return false
    return true
  }, [selected, counterparty, anchorDate])

  const handleApply = async () => {
    if (!selected || !canApply) return
    setApplying(true)
    try {
      const ownersToSend: Record<string, string> = {}
      for (const [slug, name] of Object.entries(ownerOverrides)) {
        const trimmed = name.trim()
        const def = selected.steps.find(s => s.slug === slug)?.defaultOwner
        if (trimmed && trimmed !== def) ownersToSend[slug] = trimmed
      }
      const body = {
        playbookId: selected.id,
        anchorDate,
        counterparty: selected.requiresCounterparty ? counterparty.trim() : undefined,
        ownerOverrides: Object.keys(ownersToSend).length > 0 ? ownersToSend : undefined,
      }
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to apply playbook')
      }
      const data = await res.json()
      toast.success(
        `Created ${data.children.length + 1} obligations for "${data.parent.title}"`,
      )
      setPreviewOpen(false)
      router.push(`/obligations?id=${data.parent.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply playbook')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] overflow-x-hidden">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/obligations')}
          className="mb-4 text-steel hover:text-graphite"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Obligations
        </Button>
        <div className="flex items-baseline justify-between flex-wrap gap-2 border-b border-black/5 pb-4">
          <div>
            <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-graphite" />
              Playbooks
            </h1>
            <p className="text-xs text-steel mt-0.5 font-mono">
              Applied workflows — each becomes a parent obligation with a tree of sub-tasks.
            </p>
          </div>
          <div className="text-xs font-mono text-steel">{list.length} playbooks</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-steel">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading playbooks...</span>
        </div>
      ) : list.length === 0 ? (
        <div className="text-xs text-steel border border-black/5 bg-white p-8 text-center rounded-card shadow-card">
          No playbooks available.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(p => {
            const disabled = p.stepCount === 0
            return (
              <div
                key={p.id}
                onClick={() => !disabled && openPreview(p.id)}
                className={`bg-white border rounded-card shadow-card p-5 transition-colors
                  ${disabled ? 'border-black/5 opacity-70 cursor-not-allowed' : 'border-black/5 hover:border-light-steel cursor-pointer'}
                `}
              >
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-semibold text-sm text-graphite mb-1">{p.name}</h3>
                <p className="text-xs text-steel mb-3 min-h-[48px]">
                  {p.description}
                </p>
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 border rounded font-mono border-black/10 bg-silicon/40 text-steel">
                    {getCategoryLabel(p.category as any) ?? p.category}
                  </span>
                  {p.recurrence && (
                    <span className="text-[10px] px-2 py-0.5 border rounded font-mono border-black/10 bg-silicon/40 text-steel capitalize">
                      {p.recurrence}
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 border rounded font-mono border-black/10 bg-silicon/40 text-steel">
                    {p.stepCount} step{p.stepCount === 1 ? '' : 's'}
                  </span>
                  {disabled && (
                    <span className="text-[10px] px-2 py-0.5 border rounded font-mono border-warning/30 bg-warning/10 text-warning">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white border-black/5 text-graphite">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-graphite">
              <span className="text-2xl">{selected?.icon}</span>
              <span>{selected?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-steel">
              {selected?.description}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              {/* Preview title bar */}
              <div className="bg-light-steel/[0.12] border border-light-steel/40 rounded p-3">
                <div className="text-[10px] text-steel uppercase tracking-[0.18em] mb-0.5">Will create</div>
                <div className="text-sm font-semibold text-graphite break-words">
                  {previewedTitle || '—'}
                </div>
                {anchorDate && (
                  <div className="text-xs text-steel mt-1 font-mono">
                    Anchor: {anchorDate} ({quarterLabel(anchorDate)})
                  </div>
                )}
              </div>

              {/* Apply inputs */}
              <div className="bg-canvas border border-black/5 rounded p-4 space-y-3">
                <h4 className="font-semibold text-xs text-steel uppercase tracking-wider">Customize</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selected.requiresCounterparty && (
                    <div>
                      <Label htmlFor="pb-counterparty" className="text-xs text-steel">
                        Counterparty
                      </Label>
                      <Input
                        id="pb-counterparty"
                        value={counterparty}
                        onChange={e => setCounterparty(e.target.value)}
                        placeholder="e.g. Acme Capital LP"
                        list="pb-counterparty-options"
                        className="mt-1 text-xs h-8"
                      />
                      <datalist id="pb-counterparty-options">
                        {counterpartyOptions.map(n => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>
                      <p className="text-[10px] text-steel/70 mt-1 leading-snug">
                        Investor/party this playbook is for. Used as the counterparty field on all created obligations.
                      </p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="pb-anchor" className="text-xs text-steel">
                      Anchor date
                    </Label>
                    <Input
                      id="pb-anchor"
                      type="date"
                      value={anchorDate}
                      onChange={e => setAnchorDate(e.target.value)}
                      className="mt-1 text-xs h-8"
                    />
                    <p className="text-[10px] text-steel/70 mt-1 leading-snug">
                      {selected.anchorDateStrategy === 'end-of-quarter'
                        ? 'Defaults to end-of-current-quarter. Each step is relative to this date.'
                        : 'Target completion date for the playbook. Steps compute from this anchor.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Steps preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs text-steel uppercase tracking-wider">
                    Steps ({selected.steps.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(v => !v)}
                    className="text-[11px] font-mono text-steel hover:text-graphite flex items-center gap-1"
                  >
                    {advancedOpen ? (
                      <><ChevronDown className="w-3 h-3" /> Hide owner overrides</>
                    ) : (
                      <><ChevronRightIcon className="w-3 h-3" /> Override owners</>
                    )}
                  </button>
                </div>
                <div className="space-y-1.5 border border-black/5 rounded p-2 bg-white">
                  {selected.steps.map((step, idx) => {
                    const due = anchorDate ? addDaysISO(anchorDate, step.offsetDaysFromAnchor) : '—'
                    const title = resolveTitle(step.title, counterparty.trim(), anchorDate || new Date().toISOString().slice(0, 10))
                    const override = ownerOverrides[step.slug] ?? step.defaultOwner
                    return (
                      <div key={step.slug} className="border border-black/5 bg-white rounded p-3">
                        <div className="flex items-start gap-3">
                          <div className="text-[10px] text-steel/70 font-mono mt-0.5 w-5 text-right flex-shrink-0">
                            {idx + 1}.
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <h5 className="font-semibold text-xs text-graphite">{title}</h5>
                              <span className={`text-[10px] px-1.5 py-0.5 border font-mono ${getRiskColor(step.riskLevel)}`}>
                                {step.riskLevel.toUpperCase()}
                              </span>
                            </div>
                            {step.description && (
                              <p className="text-[11px] text-steel mt-1">{step.description}</p>
                            )}
                            <div className="flex items-center flex-wrap gap-2 mt-1.5 text-[10px] font-mono text-steel">
                              <span>Due: {due === '—' ? '—' : formatDate(due)}</span>
                              <span>•</span>
                              <span>Owner: {override}</span>
                              {step.evidenceRequired && (
                                <>
                                  <span>•</span>
                                  <span className="text-warning">evidence required</span>
                                </>
                              )}
                            </div>
                            {advancedOpen && (
                              <div className="mt-2">
                                <Label htmlFor={`owner-${step.slug}`} className="text-[10px] text-steel">
                                  Override owner
                                </Label>
                                <Input
                                  id={`owner-${step.slug}`}
                                  value={ownerOverrides[step.slug] ?? ''}
                                  onChange={e =>
                                    setOwnerOverrides(prev => ({ ...prev, [step.slug]: e.target.value }))
                                  }
                                  placeholder={step.defaultOwner}
                                  className="mt-0.5 text-xs h-7"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {selected.steps.length === 0 && (
                    <div className="text-xs text-steel text-center py-4">
                      This playbook has no steps defined yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-black/5 pt-4">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={applying}
              className="border-black/5 text-steel hover:text-graphite text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={applying || !canApply}
              className="bg-graphite hover:bg-graphite/90 text-platinum text-xs gap-1.5"
            >
              {applying ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
              ) : (
                <><Plus className="h-3 w-3" /> Apply Playbook</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
