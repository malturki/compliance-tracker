'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BulkDeleteDialogProps {
  open: boolean
  selectedCount: number
  onClose: () => void
  onDelete: () => Promise<void>
}

export function BulkDeleteDialog({
  open,
  selectedCount,
  onClose,
  onDelete,
}: BulkDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (confirmation !== 'DELETE') {
      toast.error('Type DELETE to confirm')
      return
    }

    setSubmitting(true)
    try {
      await onDelete()
      setConfirmation('')
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
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Delete Obligations
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-400">
            You are about to permanently delete{' '}
            <span className="font-semibold text-red-400">
              {selectedCount} obligation{selectedCount > 1 ? 's' : ''}
            </span>.
            This action cannot be undone.
          </p>
          <div className="bg-red-950/30 border border-red-900/50 p-3 text-xs text-red-300">
            <strong>Warning:</strong> All completion history for these obligations will also be deleted.
          </div>
          <div>
            <Label className="text-xs text-slate-400">
              Type <span className="font-mono font-semibold text-slate-200">DELETE</span> to confirm
            </Label>
            <Input
              value={confirmation}
              onChange={e => setConfirmation(e.target.value)}
              placeholder="DELETE"
              className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs font-mono"
            />
          </div>
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
            disabled={submitting || confirmation !== 'DELETE'}
            className="bg-red-700 hover:bg-red-600 text-white text-xs"
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
