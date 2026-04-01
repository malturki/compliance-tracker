'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { RiskLevel } from '@/lib/types'

const RISK_LEVELS: RiskLevel[] = ['critical', 'high', 'medium', 'low']

type EditField = 'owner' | 'risk'

interface BulkEditDialogProps {
  open: boolean
  selectedCount: number
  onClose: () => void
  onUpdate: (field: EditField, value: string, email?: string) => Promise<void>
}

export function BulkEditDialog({
  open,
  selectedCount,
  onClose,
  onUpdate,
}: BulkEditDialogProps) {
  const [field, setField] = useState<EditField>('owner')
  const [owner, setOwner] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (field === 'owner' && !owner.trim()) {
      toast.error('Enter owner name')
      return
    }

    setSubmitting(true)
    try {
      if (field === 'owner') {
        await onUpdate('owner', owner, ownerEmail || undefined)
      } else {
        await onUpdate('risk', riskLevel)
      }
      setOwner('')
      setOwnerEmail('')
      setRiskLevel('medium')
      onClose()
    } catch (error) {
      // Error handled by parent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#0f1629] border-[#1e2d47] text-slate-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Bulk Edit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-400">
            Update {selectedCount} obligation{selectedCount > 1 ? 's' : ''}.
          </p>
          <div>
            <Label className="text-xs text-slate-400">Field to update</Label>
            <Select value={field} onValueChange={v => v && setField(v as EditField)}>
              <SelectTrigger className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                <SelectItem value="owner" className="text-slate-200 text-xs">Owner</SelectItem>
                <SelectItem value="risk" className="text-slate-200 text-xs">Risk Level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {field === 'owner' ? (
            <>
              <div>
                <Label className="text-xs text-slate-400">Owner *</Label>
                <Input
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  placeholder="Owner name"
                  className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Owner Email (optional)</Label>
                <Input
                  type="email"
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs"
                />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs text-slate-400">Risk Level</Label>
              <Select value={riskLevel} onValueChange={v => v && setRiskLevel(v as RiskLevel)}>
                <SelectTrigger className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1629] border-[#1e2d47]">
                  {RISK_LEVELS.map(r => (
                    <SelectItem key={r} value={r} className="text-slate-200 text-xs capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="border-[#1e2d47] text-slate-400 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs"
          >
            {submitting ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
