'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
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
  const [usersList, setUsersList] = useState<{ id: string; name: string | null; email: string }[]>([])

  useEffect(() => {
    if (open) {
      fetch('/api/users').then(r => r.ok ? r.json() : { users: [] }).then(d => setUsersList(d.users ?? [])).catch(() => {})
    }
  }, [open])

  const handleOwnerSelect = (v: string | null) => {
    if (!v) return
    const user = usersList.find(u => (u.name ?? u.email) === v)
    setOwner(v)
    setOwnerEmail(user?.email ?? '')
  }

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
      <DialogContent className="bg-white border-black/5 text-graphite max-w-md">
        <DialogHeader>
          <DialogTitle className="text-graphite">Bulk Edit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-steel">
            Update {selectedCount} obligation{selectedCount > 1 ? 's' : ''}.
          </p>
          <div>
            <Label className="text-xs text-steel">Field to update</Label>
            <Select value={field} onValueChange={v => v && setField(v as EditField)}>
              <SelectTrigger className="mt-1 bg-canvas border-black/5 text-graphite text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5">
                <SelectItem value="owner" className="text-graphite text-xs">Owner</SelectItem>
                <SelectItem value="risk" className="text-graphite text-xs">Risk Level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {field === 'owner' ? (
            <div>
              <Label className="text-xs text-steel">Owner *</Label>
              <Select value={owner} onValueChange={handleOwnerSelect}>
                <SelectTrigger className="mt-1 bg-canvas border-black/5 text-graphite text-xs h-9">
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent className="bg-white border-black/5">
                  {usersList.map(u => (
                    <SelectItem key={u.id} value={u.name ?? u.email} className="text-graphite text-xs">{u.name ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs text-steel">Risk Level</Label>
              <Select value={riskLevel} onValueChange={v => v && setRiskLevel(v as RiskLevel)}>
                <SelectTrigger className="mt-1 bg-canvas border-black/5 text-graphite text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-black/5">
                  {RISK_LEVELS.map(r => (
                    <SelectItem key={r} value={r} className="text-graphite text-xs capitalize">
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
            className="border-black/5 text-steel text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-graphite hover:bg-graphite/90 text-platinum text-xs"
          >
            {submitting ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
