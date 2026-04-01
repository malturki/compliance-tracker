'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { formatDate, getDaysUntil, getRiskColor, getStatusColor, getCategoryLabel } from '@/lib/utils'
import type { Obligation, Completion, Category, Status, RiskLevel, Frequency } from '@/lib/types'
import { Search, ChevronUp, ChevronDown, X, Plus, CheckCircle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

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
}: {
  item: Obligation & { computedStatus: Status; completions?: Completion[] }
  onClose: () => void
  onComplete: () => void
}) {
  const [completing, setCompleting] = useState(false)
  const [completedBy, setCompletedBy] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')

  const handleComplete = async () => {
    if (!completedBy.trim()) { toast.error('Enter your name'); return }
    try {
      const res = await fetch(`/api/obligations/${item.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedBy, notes: completionNotes }),
      })
      if (!res.ok) throw new Error()
      toast.success('Marked as complete')
      setCompleting(false)
      onComplete()
    } catch {
      toast.error('Failed to mark complete')
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
        <div className="px-5 py-4 space-y-4 text-xs">
          {/* Key dates */}
          <div className="bg-[#0a0e1a] border border-[#1e2d47] p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Next Due</span>
              <span className={`font-mono font-semibold ${item.computedStatus === 'overdue' ? 'text-red-400' : item.computedStatus === 'upcoming' ? 'text-amber-400' : 'text-slate-300'}`}>
                {formatDate(item.nextDueDate)}
                {' '}
                <span className="text-slate-500">
                  ({days === 0 ? 'today' : days > 0 ? `in ${days}d` : `${Math.abs(days)}d ago`})
                </span>
              </span>
            </div>
            {item.lastCompletedDate && (
              <div className="flex justify-between">
                <span className="text-slate-500">Last Completed</span>
                <span className="font-mono text-emerald-400">{formatDate(item.lastCompletedDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Frequency</span>
              <span className="font-mono text-slate-300">{item.frequency}</span>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            {([
              ['Owner', item.owner],
              item.assignee ? ['Assignee', item.assignee] : null,
              item.jurisdiction ? ['Jurisdiction', item.jurisdiction] : null,
              item.entity ? ['Entity', item.entity] : null,
              item.amount != null ? ['Amount', `$${item.amount.toLocaleString()}`] : null,
              item.subcategory ? ['Subcategory', item.subcategory] : null,
            ].filter(Boolean) as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-mono text-slate-300 text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {item.notes && (
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Notes</div>
              <div className="text-slate-400 bg-[#0a0e1a] border border-[#1e2d47] p-2.5 leading-relaxed">
                {item.notes}
              </div>
            </div>
          )}

          {/* Alert days */}
          {item.alertDays && item.alertDays.length > 0 && (
            <div>
              <div className="text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Alert Schedule</div>
              <div className="flex flex-wrap gap-1">
                {item.alertDays.map(d => (
                  <span key={d} className="px-1.5 py-0.5 text-[10px] font-mono bg-[#1e2d47] text-slate-400">{d}d before</span>
                ))}
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
                {item.completions.map(c => (
                  <div key={c.id} className="bg-[#0a0e1a] border border-[#1e2d47] p-2">
                    <div className="flex justify-between">
                      <span className="font-mono text-emerald-400">{formatDate(c.completedDate)}</span>
                      <span className="text-slate-500">{c.completedBy}</span>
                    </div>
                    {c.notes && <div className="text-slate-500 mt-0.5">{c.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mark complete */}
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
                  placeholder="Evidence, references..."
                  rows={2}
                  className="mt-1 w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs p-2 resize-none focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleComplete} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs h-7 flex-1">
                  Confirm Complete
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCompleting(false)} className="border-[#1e2d47] text-slate-400 text-xs h-7">
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
        </div>
      </ScrollArea>
    </div>
  )
}

function AddObligationDialog({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    title: '', category: 'tax' as Category, frequency: 'annual' as Frequency,
    nextDueDate: '', owner: '', riskLevel: 'medium' as RiskLevel,
    notes: '', jurisdiction: '', subcategory: '', amount: '',
  })

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
            <Input value={form.owner} onChange={e => set('owner', e.target.value)} className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs" />
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

  const [items, setItems] = useState<ObligationWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [riskLevel, setRiskLevel] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('next_due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'))
  const [selectedItem, setSelectedItem] = useState<(Obligation & { computedStatus: Status; completions?: Completion[] }) | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (status) params.set('status', status)
    if (riskLevel) params.set('risk_level', riskLevel)
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
  }, [category, status, riskLevel, search, sortBy, sortDir])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    if (!selectedId) { setSelectedItem(null); return }
    fetch(`/api/obligations/${selectedId}`)
      .then(r => r.json())
      .then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status }))
      .catch(() => setSelectedItem(null))
  }, [selectedId])

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 text-slate-600" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2d47] flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Obligations</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{items.length} obligations</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 gap-1.5">
            <Plus className="w-3 h-3" /> Add
          </Button>
        </div>

        {/* Filters */}
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
          {(category || status || riskLevel || search) && (
            <button
              onClick={() => { setCategory(''); setStatus(''); setRiskLevel(''); setSearch('') }}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a0e1a] border-b border-[#1e2d47] z-10">
              <tr>
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
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-600">No obligations found</td></tr>
              ) : (
                items.map((item, i) => {
                  const days = getDaysUntil(item.nextDueDate)
                  const isSelected = selectedId === item.id
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(isSelected ? null : item.id)}
                      className={`border-b border-[#1e2d47]/50 cursor-pointer transition-colors
                        ${isSelected ? 'bg-amber-950/20 border-l-2 border-l-amber-500' : i % 2 === 0 ? 'hover:bg-[#0f1629]' : 'bg-[#0a0e1a]/50 hover:bg-[#0f1629]'}
                        ${item.computedStatus === 'overdue' ? 'hover:bg-red-950/10' : ''}
                      `}
                    >
                      <td className="px-3 py-2 max-w-[280px]">
                        <span className={`font-medium leading-tight ${item.computedStatus === 'overdue' ? 'text-red-300' : 'text-slate-200'}`}>
                          {item.title}
                        </span>
                        {item.jurisdiction && <span className="text-slate-600 ml-1.5 text-[10px]">{item.jurisdiction}</span>}
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
                      <td className="px-2 py-2 text-slate-600"><ChevronRight className="w-3 h-3" /></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      <Sheet open={!!selectedId && !!selectedItem} onOpenChange={open => !open && setSelectedId(null)}>
        <SheetContent
          side="right"
          className="w-[420px] p-0 bg-[#0f1629] border-l border-[#1e2d47] text-slate-200"
        >
          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              onClose={() => setSelectedId(null)}
              onComplete={() => { fetchItems(); if (selectedId) { fetch(`/api/obligations/${selectedId}`).then(r => r.json()).then(d => setSelectedItem({ ...d, alertDays: d.alertDays || [], computedStatus: d.status })) } }}
            />
          )}
        </SheetContent>
      </Sheet>

      <AddObligationDialog open={showAdd} onClose={() => setShowAdd(false)} onSave={fetchItems} />
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
