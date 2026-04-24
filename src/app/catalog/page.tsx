'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Library, Plus, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getCategoryLabel, getRiskColor } from '@/lib/utils'
import type { RecommendedItem, CatalogTag } from '@/data/recommended-additions'

interface CatalogResponse {
  items: RecommendedItem[]
  tagLabels: Record<string, string>
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Pick a sensible default anchor date from the item's frequency. */
function defaultDueDate(frequency: string): string {
  const today = new Date().toISOString().slice(0, 10)
  switch (frequency) {
    case 'monthly':   return addDaysISO(today, 30)
    case 'quarterly': return addDaysISO(today, 90)
    case 'annual':    return addDaysISO(today, 365)
    case 'weekly':    return addDaysISO(today, 7)
    default:          return addDaysISO(today, 30)
  }
}

export default function CatalogPage() {
  const router = useRouter()
  const [items, setItems] = useState<RecommendedItem[]>([])
  const [tagLabels, setTagLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [activeTags, setActiveTags] = useState<Set<CatalogTag>>(new Set())
  const [query, setQuery] = useState('')
  const [showMature, setShowMature] = useState<'all' | 'now' | 'future'>('now')

  // Add-to-tracker dialog state
  const [selected, setSelected] = useState<RecommendedItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [owner, setOwner] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [jurisdiction, setJurisdiction] = useState('')
  const [adding, setAdding] = useState(false)

  const loadCatalog = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/catalog')
      if (!res.ok) throw new Error('Failed to load catalog')
      const data: CatalogResponse = await res.json()
      setItems(data.items)
      setTagLabels(data.tagLabels)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load catalog', {
        action: { label: 'Retry', onClick: loadCatalog },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog()
  }, [])

  const allTags = useMemo(() => {
    const set = new Set<CatalogTag>()
    items.forEach(i => i.tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(item => {
      if (showMature !== 'all' && item.maturity !== showMature) return false
      if (activeTags.size > 0 && !item.tags.some(t => activeTags.has(t))) return false
      if (q) {
        const hay = `${item.title} ${item.whyItMatters} ${item.consequenceOfMissing} ${item.applicabilityHint ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [items, activeTags, query, showMature])

  const toggleTag = (tag: CatalogTag) => {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const openAddDialog = (item: RecommendedItem) => {
    setSelected(item)
    setDueDate(defaultDueDate(item.frequency))
    setOwner(item.suggestedOwner)
    setCounterparty(item.defaultCounterparty ?? '')
    setJurisdiction(item.defaultJurisdiction ?? '')
    setAddOpen(true)
  }

  const handleAdd = async () => {
    if (!selected) return
    if (!owner.trim()) {
      toast.error('Owner is required')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      toast.error('Due date must be YYYY-MM-DD')
      return
    }
    setAdding(true)
    try {
      const body = {
        title: selected.title,
        description: selected.defaultDescription ?? selected.whyItMatters,
        category: selected.category,
        frequency: selected.frequency,
        nextDueDate: dueDate,
        owner: owner.trim(),
        riskLevel: selected.defaultRiskLevel,
        alertDays: [7, 1],
        entity: 'Pi Squared Inc.',
        counterparty: counterparty.trim() || null,
        jurisdiction: jurisdiction.trim() || null,
        amount: selected.defaultAmount ?? null,
        autoRecur: selected.frequency !== 'one-time' && selected.frequency !== 'event-triggered',
      }
      const res = await fetch('/api/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create obligation')
      }
      const created = await res.json()
      toast.success(`Added "${created.title}" to your tracker`)
      setAddOpen(false)
      router.push(`/obligations?id=${created.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to add obligation')
    } finally {
      setAdding(false)
    }
  }

  const clearAll = () => {
    setActiveTags(new Set())
    setQuery('')
    setShowMature('now')
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
              <Library className="w-5 h-5 text-graphite" />
              Recommended Additions
            </h1>
            <p className="text-xs text-steel mt-0.5 font-mono">
              Standard-startup compliance items curated for our profile. Browse, pick, add.
            </p>
          </div>
          <div className="text-xs font-mono text-steel">{filtered.length}/{items.length} items</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-black/5 rounded-card shadow-card p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-steel" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search catalog..."
              className="pl-7 bg-white border-black/5 text-graphite text-xs h-8 placeholder:text-steel/70"
            />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setShowMature('now')}
              className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors ${showMature === 'now' ? 'bg-graphite text-platinum border-graphite' : 'border-black/10 text-steel hover:text-graphite'}`}
            >
              Now
            </button>
            <button
              onClick={() => setShowMature('future')}
              className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors ${showMature === 'future' ? 'bg-graphite text-platinum border-graphite' : 'border-black/10 text-steel hover:text-graphite'}`}
            >
              Future
            </button>
            <button
              onClick={() => setShowMature('all')}
              className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors ${showMature === 'all' ? 'bg-graphite text-platinum border-graphite' : 'border-black/10 text-steel hover:text-graphite'}`}
            >
              All
            </button>
          </div>
          {(activeTags.size > 0 || query || showMature !== 'now') && (
            <button
              onClick={clearAll}
              className="text-xs text-steel hover:text-graphite flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => {
            const active = activeTags.has(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-[11px] font-mono px-2 py-0.5 border rounded transition-colors ${
                  active
                    ? 'bg-light-steel/[0.28] border-light-steel text-graphite'
                    : 'bg-white border-black/10 text-steel hover:text-graphite'
                }`}
              >
                {tagLabels[tag] ?? tag}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-steel">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading catalog...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-steel border border-black/5 bg-white p-8 text-center rounded-card shadow-card">
          No items match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const isFuture = item.maturity === 'future'
            return (
              <div
                key={item.id}
                className={`bg-white border rounded-card shadow-card p-5 transition-colors flex flex-col
                  ${isFuture ? 'border-black/5 opacity-70' : 'border-black/5 hover:border-light-steel'}
                `}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm text-graphite leading-tight">{item.title}</h3>
                  <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded flex-shrink-0 ${getRiskColor(item.defaultRiskLevel)}`}>
                    {item.defaultRiskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <span className="text-[10px] px-1.5 py-0.5 border rounded font-mono border-black/10 bg-silicon/40 text-steel">
                    {getCategoryLabel(item.category)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 border rounded font-mono border-black/10 bg-silicon/40 text-steel capitalize">
                    {item.frequency}
                  </span>
                  {isFuture && (
                    <span className="text-[10px] px-1.5 py-0.5 border rounded font-mono border-warning/30 bg-warning/10 text-warning">
                      Future
                    </span>
                  )}
                </div>
                {item.applicabilityHint && (
                  <div className="text-[11px] text-steel/70 font-mono italic mb-2">
                    {item.applicabilityHint}
                  </div>
                )}
                <p className="text-xs text-steel leading-relaxed mb-3">{item.whyItMatters}</p>
                <div className="text-[11px] text-danger/80 leading-relaxed mb-4 border-l-2 border-danger/30 pl-2">
                  <span className="font-semibold">If missed:</span> {item.consequenceOfMissing}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map(t => (
                      <span key={t} className="text-[9px] font-mono text-steel/70 uppercase tracking-wider">
                        #{t}
                      </span>
                    ))}
                  </div>
                  {isFuture ? (
                    <div className="text-[11px] text-steel/70 font-mono">Add later</div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => openAddDialog(item)}
                      className="bg-graphite hover:bg-graphite/90 text-platinum text-xs h-7 gap-1.5"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add-to-tracker dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg bg-white border-black/5 text-graphite">
          <DialogHeader>
            <DialogTitle className="text-graphite">Add to tracker</DialogTitle>
            <DialogDescription className="text-steel">
              Review the defaults and adjust before adding.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="bg-canvas border border-black/5 rounded p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-steel mb-0.5">Title</div>
                <div className="text-sm font-semibold text-graphite">{selected.title}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cat-due" className="text-xs text-steel">Next due date</Label>
                  <Input
                    id="cat-due"
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-owner" className="text-xs text-steel">Owner</Label>
                  <Input
                    id="cat-owner"
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    placeholder="e.g. CFO"
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-cp" className="text-xs text-steel">Counterparty</Label>
                  <Input
                    id="cat-cp"
                    value={counterparty}
                    onChange={e => setCounterparty(e.target.value)}
                    placeholder="optional"
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="cat-juris" className="text-xs text-steel">Jurisdiction</Label>
                  <Input
                    id="cat-juris"
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                    placeholder="optional"
                    className="mt-1 text-xs h-8"
                  />
                </div>
              </div>
              <p className="text-[10px] text-steel/70 leading-snug">
                Risk, category, and frequency are pre-set based on the catalog item. You can edit everything later from the obligation detail panel.
              </p>
            </div>
          )}
          <DialogFooter className="border-t border-black/5 pt-4">
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={adding}
              className="border-black/5 text-steel hover:text-graphite text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={adding}
              className="bg-graphite hover:bg-graphite/90 text-platinum text-xs gap-1.5"
            >
              {adding ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Adding...</>
              ) : (
                <><Plus className="w-3 h-3" /> Add to tracker</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
