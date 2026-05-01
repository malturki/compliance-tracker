'use client'

import Link from 'next/link'
import { CheckCircle2, Sparkles } from 'lucide-react'

interface Props {
  /** Variant changes the copy + CTA. */
  variant: 'caught-up' | 'nothing-scheduled' | 'tracker-empty'
  canEdit: boolean
}

export function TodayEmptyState({ variant, canEdit }: Props) {
  if (variant === 'caught-up') {
    return (
      <div className="bg-success/[0.08] border border-success/30 rounded-card p-6 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-success/[0.15] border border-success/30 mb-3">
          <CheckCircle2 className="w-5 h-5 text-success" />
        </div>
        <h3 className="text-sm font-semibold text-graphite mb-1">All caught up</h3>
        <p className="text-xs text-steel">Nothing overdue or due today. The week below has what's next.</p>
      </div>
    )
  }

  if (variant === 'nothing-scheduled') {
    return (
      <div className="bg-white border border-black/5 rounded-card shadow-card p-8 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-light-steel/[0.18] border border-light-steel/40 mb-4">
          <CheckCircle2 className="w-5 h-5 text-graphite" />
        </div>
        <h3 className="text-sm font-semibold text-graphite mb-1">Nothing scheduled in the next 30 days</h3>
        <p className="text-xs text-steel mb-4">
          Visit <Link href="/obligations" className="underline hover:text-graphite">Obligations</Link> for the full list.
        </p>
      </div>
    )
  }

  // tracker-empty
  return (
    <div className="bg-white border border-black/5 rounded-card shadow-card p-8 text-center max-w-2xl mx-auto">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-light-steel/[0.18] border border-light-steel/40 mb-5">
        <Sparkles className="w-6 h-6 text-graphite" />
      </div>
      <h2 className="text-lg font-semibold text-graphite mb-2">Nothing tracked yet</h2>
      <p className="text-sm text-steel mb-6 leading-relaxed">
        {canEdit
          ? 'Get started by applying a playbook, browsing the catalog of recommended additions, or adding an obligation manually.'
          : 'An editor or admin needs to add obligations before anything shows up here.'}
      </p>
      {canEdit && (
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/playbooks"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-graphite hover:bg-graphite/90 text-white text-xs font-medium rounded transition-colors"
          >
            Apply a playbook
          </Link>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-black/5 hover:border-light-steel text-graphite text-xs font-medium rounded transition-colors"
          >
            Browse catalog
          </Link>
          <Link
            href="/obligations"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-black/5 hover:border-light-steel text-graphite text-xs font-medium rounded transition-colors"
          >
            Add manually →
          </Link>
        </div>
      )}
    </div>
  )
}
