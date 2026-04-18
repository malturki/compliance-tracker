'use client'

import { CheckCircle, Edit, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BulkActionBarProps {
  selectedCount: number
  onClear: () => void
  onMarkComplete: () => void
  onEdit: () => void
  onDelete: () => void
}

export function BulkActionBar({
  selectedCount,
  onClear,
  onMarkComplete,
  onEdit,
  onDelete,
}: BulkActionBarProps) {
  return (
    <div className="px-6 py-3 border-b border-black/5 bg-light-steel/[0.18] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-graphite">
          {selectedCount} selected
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="h-7 text-xs text-steel hover:text-graphite"
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onMarkComplete}
          className="h-7 text-xs bg-graphite text-platinum hover:bg-graphite/90"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Mark Complete
        </Button>
        <Button
          size="sm"
          onClick={onEdit}
          className="h-7 text-xs bg-graphite text-platinum hover:bg-graphite/90"
        >
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="h-7 text-xs bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  )
}
