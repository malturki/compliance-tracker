'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Check, Square, CheckSquare } from 'lucide-react'
import { formatDate, getCategoryLabel, getRiskColor } from '@/lib/utils'

interface TemplateListItem {
  id: string
  name: string
  description: string
  category: string
  icon: string
  obligationCount: number
}

interface TemplateObligation {
  index: number
  title: string
  description?: string
  category: string
  frequency: string
  owner: string
  riskLevel: string
  jurisdiction?: string
  amount?: number
  notes?: string
  previewDueDate: string
  autoRecur: boolean
}

interface TemplateDetail {
  id: string
  name: string
  description: string
  category: string
  icon: string
  obligations: TemplateObligation[]
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDetail | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([])
  const [customOwner, setCustomOwner] = useState('')
  const [customEntity, setCustomEntity] = useState('Pi Squared Inc.')

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      setTemplates(data.templates)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplateDetail = async (templateId: string) => {
    try {
      const res = await fetch(`/api/templates/${templateId}`)
      if (!res.ok) throw new Error('Failed to load template details')
      const data = await res.json()
      setSelectedTemplate(data)
      setSelectedIndexes(data.obligations.map((_: any, idx: number) => idx))
      setCustomOwner('')
      setPreviewOpen(true)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load template')
    }
  }

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return
    if (selectedIndexes.length === 0) {
      toast.error('Select at least one obligation to import')
      return
    }

    setApplying(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          customizations: {
            owner: customOwner.trim() || undefined,
            entity: customEntity.trim() || 'Pi Squared Inc.',
            selectedObligationIndexes: selectedIndexes,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to apply template')
      }

      const data = await res.json()
      toast.success(data.message)
      setPreviewOpen(false)
      router.push('/obligations')
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply template')
    } finally {
      setApplying(false)
    }
  }

  const toggleObligation = (index: number) => {
    setSelectedIndexes(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const toggleAll = () => {
    if (!selectedTemplate) return
    if (selectedIndexes.length === selectedTemplate.obligations.length) {
      setSelectedIndexes([])
    } else {
      setSelectedIndexes(selectedTemplate.obligations.map((_, idx) => idx))
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12 text-steel">Loading templates...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/obligations')}
            className="mb-4 text-steel hover:text-graphite"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Obligations
          </Button>

          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite mb-2">Template Library</h1>
          <p className="text-sm text-steel">
            Jump-start your compliance tracking with pre-built obligation sets.
          </p>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white border border-black/5 rounded-card shadow-card p-5 hover:border-light-steel transition-colors cursor-pointer"
              onClick={() => loadTemplateDetail(template.id)}
            >
              <div className="text-3xl mb-3">{template.icon}</div>
              <h3 className="font-semibold text-sm text-graphite mb-1">{template.name}</h3>
              <p className="text-xs text-steel mb-3 min-h-[36px]">
                {template.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 border rounded font-mono border-black/10 bg-silicon/40 text-steel">
                  {template.category.replace(/-/g, ' ')}
                </span>
                <span className="bg-silicon/40 text-steel text-[10px] font-mono px-2 py-0.5 rounded">
                  {template.obligationCount} items
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Preview/Apply Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white border-black/5 text-graphite">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-graphite">
                <span className="text-2xl">{selectedTemplate?.icon}</span>
                <span>{selectedTemplate?.name}</span>
              </DialogTitle>
              <DialogDescription className="text-steel">{selectedTemplate?.description}</DialogDescription>
            </DialogHeader>

            {selectedTemplate && (
              <div className="space-y-5">
                {/* Customization */}
                <div className="bg-canvas border border-black/5 rounded p-4 space-y-3">
                  <h4 className="font-semibold text-xs text-steel uppercase tracking-wider">Customize</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="custom-owner" className="text-xs text-steel">
                        Override Owner (optional)
                      </Label>
                      <Input
                        id="custom-owner"
                        value={customOwner}
                        onChange={(e) => setCustomOwner(e.target.value)}
                        placeholder="e.g., CFO"
                        className="mt-1 text-xs h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="custom-entity" className="text-xs text-steel">
                        Entity Name
                      </Label>
                      <Input
                        id="custom-entity"
                        value={customEntity}
                        onChange={(e) => setCustomEntity(e.target.value)}
                        className="mt-1 text-xs h-8"
                      />
                    </div>
                  </div>
                </div>

                {/* Obligation Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-xs text-steel uppercase tracking-wider">
                      Obligations ({selectedIndexes.length}/{selectedTemplate.obligations.length} selected)
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAll}
                      className="text-xs text-steel hover:text-graphite h-6"
                    >
                      {selectedIndexes.length === selectedTemplate.obligations.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto border border-black/5 rounded p-2">
                    {selectedTemplate.obligations.map((obligation) => {
                      const isSelected = selectedIndexes.includes(obligation.index)

                      return (
                        <div
                          key={obligation.index}
                          className={`border rounded p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-light-steel/[0.18] border-light-steel'
                              : 'bg-white border-black/5 hover:border-silicon'
                          }`}
                          onClick={() => toggleObligation(obligation.index)}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex-shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-graphite" />
                              ) : (
                                <Square className="w-4 h-4 text-steel/60" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h5 className="font-semibold text-xs text-graphite">{obligation.title}</h5>
                                <span className={`text-[10px] px-1.5 py-0.5 border font-mono ${getRiskColor(obligation.riskLevel as any)}`}>
                                  {obligation.riskLevel.toUpperCase()}
                                </span>
                              </div>

                              {obligation.description && (
                                <p className="text-[11px] text-steel mb-1.5">{obligation.description}</p>
                              )}

                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                <Badge variant="outline" className="font-mono border-black/10 text-steel py-0">
                                  {getCategoryLabel(obligation.category as any)}
                                </Badge>
                                <Badge variant="outline" className="font-mono border-black/10 text-steel py-0">
                                  {obligation.frequency}
                                </Badge>
                                <Badge variant="outline" className="border-black/10 text-steel py-0">
                                  Due: {formatDate(obligation.previewDueDate)}
                                </Badge>
                                <Badge variant="outline" className="border-black/10 text-steel py-0">
                                  Owner: {obligation.owner}
                                </Badge>
                                {obligation.amount && (
                                  <Badge variant="outline" className="border-success/30 text-success py-0">
                                    ${obligation.amount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
                onClick={handleApplyTemplate}
                disabled={applying || selectedIndexes.length === 0}
                className="bg-graphite hover:bg-graphite/90 text-platinum text-xs gap-1.5"
              >
                {applying ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    Import {selectedIndexes.length} Obligation{selectedIndexes.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
