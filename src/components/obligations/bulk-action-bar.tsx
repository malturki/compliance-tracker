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
    <div className="px-6 py-3 border-b border-[#1e2d47] bg-amber-950/20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-300">
          {selectedCount} selected
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="h-7 text-xs text-slate-500 hover:text-slate-300"
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onMarkComplete}
          className="h-7 text-xs border-emerald-700/50 text-emerald-300 hover:bg-emerald-950/30"
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          Mark Complete
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="h-7 text-xs border-[#1e2d47] text-slate-300 hover:bg-[#1e2d47]"
        >
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="h-7 text-xs border-red-700/50 text-red-300 hover:bg-red-950/30"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  )
}
