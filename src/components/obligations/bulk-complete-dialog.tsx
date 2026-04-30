'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const { data: session } = useSession()
  const [completedBy, setCompletedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string | null; email: string }[]>([])

  // Load users + default to the current session user when the dialog opens.
  useEffect(() => {
    if (!open) return
    fetch('/api/users')
      .then(r => (r.ok ? r.json() : { users: [] }))
      .then(d => setUsers(d.users ?? []))
      .catch(() => setUsers([]))
    if (!completedBy && session?.user?.email) {
      setCompletedBy(session.user.email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.user?.email])

  const handleSubmit = async () => {
    if (!completedBy.trim()) {
      toast.error('Select who completed this')
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
            <Select value={completedBy} onValueChange={v => v && setCompletedBy(v)}>
              <SelectTrigger className="mt-1 bg-canvas border-black/5 text-graphite text-xs">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent className="bg-white border-black/5 max-h-72 overflow-y-auto">
                {users.length === 0 && session?.user?.email && (
                  <SelectItem value={session.user.email} className="text-graphite text-xs">
                    {session.user.name ?? session.user.email}{' '}
                    <span className="text-steel/70 font-mono">({session.user.email})</span>
                  </SelectItem>
                )}
                {users.map(u => (
                  <SelectItem key={u.id} value={u.email} className="text-graphite text-xs">
                    {u.name ?? u.email}
                    {u.name && (
                      <span className="text-steel/70 font-mono ml-1">({u.email})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-steel/70 mt-1 leading-snug">
              Defaults to you. Pick another user if logging on someone else's behalf.
            </p>
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
