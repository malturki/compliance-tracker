'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatDate, getDaysUntil, getRiskColor, getStatusColor, getCategoryLabel } from '@/lib/utils'
import type { Obligation, Completion, Category, Status, RiskLevel, Frequency } from '@/lib/types'
import { Search, ChevronUp, ChevronDown, X, Plus, CheckCircle, ChevronRight, FileText, ExternalLink, Download, Image as ImageIcon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
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
    completed: 'DONE', unknown: 'UNKNOWN', 'not-applicable': 'N/A',
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

function DetailPanel({
  item,
  onClose,
  onComplete,
  canEdit,
}: {
  item: Obligation & { computedStatus: Status; completions?: Completion[] }
  onClose: () => void
  onComplete: () => void
  canEdit: boolean
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
      <SheetHeader className="px-5 pt-5 pb-4 border-b border-[#1e2d47]">
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="text-sm font-semibold text-slate-100 leading-tight pr-8">{item.title}</SheetTitle>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={item.computedStatus} />
          <RiskBadge risk={item.riskLevel as RiskLevel} />
          <span className="text-xs font-mono text-slate-500">{getCategoryLabel(item.category)}</span>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-5 text-xs">
          {/* Hero: Next due date — most important info, largest text */}
          <div className={`border p-4 ${
            item.computedStatus === 'overdue' ? 'bg-red-950/20 border-red-900/40'
            : item.computedStatus === 'upcoming' ? 'bg-amber-950/20 border-amber-900/40'
            : item.computedStatus === 'completed' ? 'bg-emerald-950/20 border-emerald-900/40'
            : 'bg-[#0a0e1a] border-[#1e2d47]'
          }`}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Next Due</div>
            <div className={`text-lg font-mono font-semibold ${
              item.computedStatus === 'overdue' ? 'text-red-400'
              : item.computedStatus === 'upcoming' ? 'text-amber-400'
              : item.computedStatus === 'completed' ? 'text-emerald-400'
              : 'text-slate-200'
            }`}>
              {formatDate(item.nextDueDate)}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {item.computedStatus === 'completed' ? 'Completed — no recurrence' : days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Schedule</div>
            <div className="bg-[#0a0e1a] border border-[#1e2d47] divide-y divide-[#1e2d47]">
              <div className="flex justify-between px-3 py-2">
                <span className="text-slate-500">Frequency</span>
                <span className="font-mono text-slate-300">{item.frequency}</span>
              </div>
              {item.lastCompletedDate && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-slate-500">Last Completed</span>
                  <span className="font-mono text-emerald-400">{formatDate(item.lastCompletedDate)}</span>
                </div>
              )}
              {item.alertDays && item.alertDays.length > 0 && (
                <div className="flex justify-between items-center px-3 py-2">
                  <span className="text-slate-500">Alerts</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {item.alertDays.map(d => (
                      <span key={d} className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1e2d47] text-slate-400 rounded">{d}d</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Assignment</div>
            <div className="bg-[#0a0e1a] border border-[#1e2d47] divide-y divide-[#1e2d47]">
              <div className="flex justify-between px-3 py-2">
                <span className="text-slate-500">Owner</span>
                <span className="font-mono text-slate-300 text-right">{item.owner}</span>
              </div>
              {item.assignee && (
                <div className="flex justify-between px-3 py-2">
                  <span className="text-slate-500">Assignee</span>
                  <span className="font-mono text-slate-300 text-right">{item.assignee}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details — only render if any field is present */}
          {(item.counterparty || item.jurisdiction || item.entity || item.amount != null || item.subcategory) && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Details</div>
              <div className="bg-[#0a0e1a] border border-[#1e2d47] divide-y divide-[#1e2d47]">
                {item.counterparty && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-500">Counterparty</span>
                    <span className="font-mono text-slate-300 text-right">{item.counterparty}</span>
                  </div>
                )}
                {item.jurisdiction && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-500">Jurisdiction</span>
                    <span className="font-mono text-slate-300 text-right">{item.jurisdiction}</span>
                  </div>
                )}
                {item.entity && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-500">Entity</span>
                    <span className="font-mono text-slate-300 text-right">{item.entity}</span>
                  </div>
                )}
                {item.amount != null && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-mono text-slate-300 text-right">${item.amount.toLocaleString()}</span>
                  </div>
                )}
                {item.subcategory && (
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-slate-500">Subcategory</span>
                    <span className="font-mono text-slate-300 text-right">{item.subcategory}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Notes</div>
              <div className="text-slate-300 bg-[#0a0e1a] border border-[#1e2d47] p-3 leading-relaxed">
                {item.notes}
              </div>
            </div>
          )}

          {/* Completion history */}
          {item.completions && item.completions.length > 0 && (
            <div>
              <Separator className="mb-3 bg-[#1e2d47]" />
              <div className="text-slate-500 mb-2 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
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
                    <div key={c.id} className="bg-[#0a0e1a] border border-[#1e2d47] p-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-emerald-400">{formatDate(c.completedDate)}</span>
                        <span className="text-slate-500">{c.completedBy}</span>
                      </div>
                      {c.notes && <div className="text-slate-500 mt-0.5">{c.notes}</div>}
                      {evidenceUrls.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-slate-600 text-[10px] uppercase tracking-wider">Evidence</div>
                          {evidenceUrls.map((url, idx) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                            const isPDF = /\.pdf$/i.test(url)
                            const isExternal = url.startsWith('http') && !url.includes('blob.vercel-storage.com')
                            
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                {isImage && (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img src={url} alt="Evidence" className="h-16 w-16 object-cover rounded border border-[#1e2d47] hover:border-amber-500/50 transition-colors" />
                                  </a>
                                )}
                                <a 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
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
          <Separator className="bg-[#1e2d47]" />
          <ObligationHistory obligationId={item.id} />

          {/* Mark complete */}
          {canEdit && (
            <>
          <Separator className="bg-[#1e2d47]" />
          {completing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-400">Completed by</Label>
                <Input
                  value={completedBy}
                  onChange={e => setCompletedBy(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Notes (optional)</Label>
                <textarea
                  value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  placeholder="Additional details..."
                  rows={2}
                  className="mt-1 w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs p-2 resize-none focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Evidence (optional)</Label>
                <div className="mt-1 space-y-2">
                  <FileUpload
                    files={evidenceFiles}
                    onChange={setEvidenceFiles}
                    maxFiles={5}
                    maxSizeMB={10}
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-[#1e2d47]" />
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">or</span>
                    <div className="h-px flex-1 bg-[#1e2d47]" />
                  </div>
                  <Input
                    value={evidenceUrl}
                    onChange={e => setEvidenceUrl(e.target.value)}
                    placeholder="Paste link to document..."
                    className="bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-8"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleComplete} 
                  disabled={uploading}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs h-7 flex-1 disabled:opacity-50"
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
                  className="border-[#1e2d47] text-slate-400 text-xs h-7"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setCompleting(true)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs h-8"
            >
              <CheckCircle className="w-3 h-3 mr-1.5" /> Mark Complete
            </Button>
          )}
            </>
          )}
        </div>
      </ScrollArea>
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
      <DialogContent className="bg-[#0f1629] border-[#1e2d47] text-slate-200 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Add Obligation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs text-slate-400">Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Category *</Label>
              <Select value={form.category} onValueChange={v => v && set('category', v as Category)}>
                <SelectTrigger className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="text-slate-200 text-xs">{getCategoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Frequency *</Label>
              <Select value={form.frequency} onValueChange={v => v && set('frequency', v as Frequency)}>
                <SelectTrigger className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f} value={f} className="text-slate-200 text-xs">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Next Due Date *</Label>
              <Input type="date" value={form.nextDueDate} onChange={e => set('nextDueDate', e.target.value)} className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Risk Level</Label>
              <Select value={form.riskLevel} onValueChange={v => v && set('riskLevel', v as RiskLevel)}>
                <SelectTrigger className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                  {RISK_LEVELS.map(r => (
                    <SelectItem key={r} value={r} className="text-slate-200 text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Owner *</Label>
            <Select value={form.owner} onValueChange={v => v && set('owner', v)}>
              <SelectTrigger className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-9">
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                {usersList.map(u => (
                  <SelectItem key={u.id} value={u.name ?? u.email} className="text-slate-200 text-xs">{u.name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Counterparty</Label>
            <Input
              list="counterparty-options"
              value={form.counterparty}
              onChange={e => set('counterparty', e.target.value)}
              placeholder="e.g. AWS, California FTB, Republic Registered Agent"
              className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs"
            />
            <datalist id="counterparty-options">
              {counterpartyOptions.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Jurisdiction</Label>
              <Input value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)} className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Notes</Label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} className="mt-1 w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs p-2 resize-none focus:outline-none focus:border-amber-500/50" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#1e2d47] text-slate-400 text-xs">Cancel</Button>
          <Button onClick={handleSubmit} className="bg-amber-600 hover:bg-amber-500 text-white text-xs">Add Obligation</Button>
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
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'))
  const [selectedItem, setSelectedItem] = useState<(Obligation & { computedStatus: Status; completions?: Completion[] }) | null>(null)
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
    if (!selectedId) { setSelectedItem(null); return }
    fetch(`/api/obligations/${selectedId}`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() })
      .then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status }))
      .catch(() => setSelectedItem(null))
  }, [selectedId])

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
        setSelectedIds(new Set(items.map(i => i.id)))
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
      setSelectedIds(new Set(items.map(i => i.id)))
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
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 text-slate-600" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Obligations</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{items.length} obligations</p>
          </div>
          {!bulkMode && canEdit && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/templates')}
                className="border-[#1e2d47] text-slate-300 hover:text-slate-100 hover:bg-[#1e2d47] text-xs h-7 gap-1.5"
              >
                <FileText className="w-3 h-3" /> Import Template
              </Button>
              <Button size="sm" onClick={() => setShowAdd(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 gap-1.5">
                <Plus className="w-3 h-3" /> Add
              </Button>
            </div>
          )}
        </div>

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
          <div className="px-6 py-3 border-b border-[#1e2d47] flex items-center gap-3 flex-shrink-0 bg-[#0a0e1a]">
            <div className="relative flex-shrink-0 w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 bg-[#0f1629] border-[#1e2d47] text-slate-200 text-xs h-7 placeholder:text-slate-600"
              />
            </div>
            <Select value={category || 'all'} onValueChange={v => v && setCategory(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-36 bg-[#0f1629] border-[#1e2d47] text-slate-300 text-xs h-7">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                <SelectItem value="all" className="text-slate-300 text-xs">All Categories</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c} className="text-slate-300 text-xs">{getCategoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={v => v && setStatus(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-32 bg-[#0f1629] border-[#1e2d47] text-slate-300 text-xs h-7">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                <SelectItem value="all" className="text-slate-300 text-xs">All Status</SelectItem>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s} className="text-slate-300 text-xs capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskLevel || 'all'} onValueChange={v => v && setRiskLevel(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-28 bg-[#0f1629] border-[#1e2d47] text-slate-300 text-xs h-7">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                <SelectItem value="all" className="text-slate-300 text-xs">All Risk</SelectItem>
                {RISK_LEVELS.map(r => (
                  <SelectItem key={r} value={r} className="text-slate-300 text-xs capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={counterparty || 'all'} onValueChange={v => v && setCounterparty(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44 bg-[#0f1629] border-[#1e2d47] text-slate-300 text-xs h-7">
                <SelectValue placeholder="Counterparty" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1629] border-[#1e2d47] max-h-72 overflow-y-auto">
                <SelectItem value="all" className="text-slate-300 text-xs">All Counterparties</SelectItem>
                {counterpartyOptions.map(name => (
                  <SelectItem key={name} value={name} className="text-slate-300 text-xs">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(category || status || riskLevel || counterparty || search) && (
              <button
                onClick={() => { setCategory(''); setStatus(''); setRiskLevel(''); setCounterparty(''); setSearch('') }}
                className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a0e1a] border-b border-[#1e2d47] z-10">
              <tr>
                {canEdit && (
                <th className="px-3 py-2.5 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className="border-slate-600"
                  />
                </th>
                )}
                {([
                  ['title', 'Obligation', 'text-left'],
                  ['category', 'Category', 'text-left'],
                  ['frequency', 'Freq', 'text-left'],
                  ['next_due_date', 'Due Date', 'text-right'],
                  ['owner', 'Owner', 'text-left'],
                ] as [SortField, string, string][]).map(([field, label, align]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`px-3 py-2.5 font-medium text-slate-500 cursor-pointer hover:text-slate-300 select-none ${align}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 font-medium text-slate-500 text-center">Status</th>
                <th
                  onClick={() => handleSort('risk_level')}
                  className="px-3 py-2.5 font-medium text-slate-500 cursor-pointer hover:text-slate-300 text-center"
                >
                  <span className="inline-flex items-center gap-1">Risk <SortIcon field="risk_level" /></span>
                </th>
                {!bulkMode && <th className="w-6" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-b border-[#1e2d47]/50 animate-pulse">
                    <td className="px-3 py-3"><div className="h-3 w-4 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-48 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-16 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-16 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-14 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-20 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-20 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-12 bg-[#1e2d47]/60 rounded" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-10 bg-[#1e2d47]/60 rounded" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center">
                    {(category || status || riskLevel || search) ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-sm text-slate-400">No obligations match these filters</div>
                        <button
                          onClick={() => {
                            setCategory('')
                            setStatus('')
                            setRiskLevel('')
                            setSearch('')
                          }}
                          className="mt-1 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 rounded transition-colors"
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">No obligations found</div>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item, i) => {
                  const days = getDaysUntil(item.nextDueDate)
                  const isSelected = bulkMode ? selectedIds.has(item.id) : selectedId === item.id
                  return (
                    <tr
                      key={item.id}
                      onClick={(e) => !bulkMode && handleRowClick(item, i, e)}
                      className={`border-b border-[#1e2d47]/50 cursor-pointer transition-colors
                        ${isSelected && !bulkMode ? 'bg-amber-950/20 border-l-2 border-l-amber-500' : ''}
                        ${isSelected && bulkMode ? 'bg-amber-950/20' : ''}
                        ${!isSelected && (i % 2 === 0 ? 'hover:bg-[#0f1629]' : 'bg-[#0a0e1a]/50 hover:bg-[#0f1629]')}
                        ${item.computedStatus === 'overdue' ? 'hover:bg-red-950/10' : ''}
                      `}
                    >
                      {canEdit && (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => handleCheckboxChange(item.id, i, new MouseEvent('click') as any)}
                          onClick={(e) => handleCheckboxChange(item.id, i, e)}
                          className="border-slate-600"
                        />
                      </td>
                      )}
                      <td className="px-3 py-2 max-w-[280px]">
                        <span className={`font-medium leading-tight ${item.computedStatus === 'overdue' ? 'text-red-300' : 'text-slate-200'}`}>
                          {item.title}
                        </span>
                        {item.jurisdiction && <span className="text-slate-600 ml-1.5 text-[10px]">{item.jurisdiction}</span>}
                        {item.counterparty && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">→ {item.counterparty}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{getCategoryLabel(item.category)}</td>
                      <td className="px-3 py-2 text-slate-500 capitalize">{item.frequency}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={item.computedStatus === 'overdue' ? 'text-red-400' : item.computedStatus === 'upcoming' ? 'text-amber-400' : 'text-slate-400'}>
                          {formatDate(item.nextDueDate)}
                        </span>
                        <span className="text-slate-600 ml-1.5 text-[10px]">
                          {days === 0 ? 'today' : days > 0 ? `+${days}d` : `${days}d`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate">{item.owner}</td>
                      <td className="px-3 py-2 text-center"><StatusBadge status={item.computedStatus} /></td>
                      <td className="px-3 py-2 text-center"><RiskBadge risk={item.riskLevel as RiskLevel} /></td>
                      {!bulkMode && <td className="px-2 py-2 text-slate-600"><ChevronRight className="w-3 h-3" /></td>}
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
          className="w-[420px] p-0 bg-[#0f1629] border-l border-[#1e2d47] text-slate-200"
        >
          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              onClose={() => setSelectedId(null)}
              onComplete={() => { fetchItems(); if (selectedId) { fetch(`/api/obligations/${selectedId}`).then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json() }).then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status })).catch(() => setSelectedId(null)) } }}
              canEdit={canEdit}
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
    <Suspense fallback={<div className="p-6 text-slate-500">Loading...</div>}>
      <ObligationsPageContent />
    </Suspense>
  )
}
