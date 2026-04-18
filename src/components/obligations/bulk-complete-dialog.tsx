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
      <DialogContent className="bg-white border-black/5 text-graphite max-w-md">
        <DialogHeader>
          <DialogTitle className="text-graphite">Mark Complete</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-steel">
            Mark {selectedCount} obligation{selectedCount > 1 ? 's' : ''} as complete.
          </p>
          <div>
            <Label className="text-xs text-steel">Completed by *</Label>
            <Input
              value={completedBy}
              onChange={e => setCompletedBy(e.target.value)}
              placeholder="Your name"
              className="mt-1 bg-canvas border-black/5 text-graphite text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-steel">Notes (optional)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Evidence, references..."
              rows={3}
              className="mt-1 w-full bg-canvas border border-black/5 text-graphite text-xs p-2 resize-none focus:outline-none focus:border-light-steel"
            />
          </div>
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
            className="bg-success hover:bg-success/90 text-white text-xs"
          >
            {submitting ? 'Completing...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
