'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface BulkCompleteDialogProps {
  open: boolean
  selectedCount: number
  onClose: () => void
  onComplete: (completedBy: string, notes: string) => Promise<void>
}

export function BulkCompleteDialog({
  open,
  selectedCount,
  onClose,
  onComplete,
}: BulkCompleteDialogProps) {
  const [completedBy, setCompletedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!completedBy.trim()) {
      toast.error('Enter your name')
      return
    }

    setSubmitting(true)
    try {
      await onComplete(completedBy, notes)
      setCompletedBy('')
      setNotes('')
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
          <DialogTitle className="text-slate-100">Mark Complete</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-400">
            Mark {selectedCount} obligation{selectedCount > 1 ? 's' : ''} as complete.
          </p>
          <div>
            <Label className="text-xs text-slate-400">Completed by *</Label>
            <Input
              value={completedBy}
              onChange={e => setCompletedBy(e.target.value)}
              placeholder="Your name"
              className="mt-1 bg-[#0a0e1a] border-[#1e2d47] text-slate-200 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Evidence, references..."
              rows={3}
              className="mt-1 w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs p-2 resize-none focus:outline-none focus:border-amber-500/50"
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
            disabled={submitting}
            className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs"
          >
            {submitting ? 'Completing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
