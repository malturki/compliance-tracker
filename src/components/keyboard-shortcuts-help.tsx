'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

type Shortcut = {
  keys: string[]
  description: string
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: 'Navigation',
    items: [
      { keys: ['⌘', 'K'], description: 'Open command palette (search, jump to page)' },
      { keys: ['?'], description: 'Show this help' },
      { keys: ['Esc'], description: 'Close any open modal or panel' },
    ],
  },
  {
    group: 'Command palette',
    items: [
      { keys: ['↑', '↓'], description: 'Move through results' },
      { keys: ['Enter'], description: 'Open selected result' },
      { keys: ['Esc'], description: 'Close palette' },
    ],
  },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-mono font-medium text-graphite bg-silicon/[0.18] border border-black/10 rounded">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when the user is typing in an input/textarea
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (isTyping) return

      if (e.key === '?') {
        e.preventDefault()
        setOpen(v => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white border border-black/5 max-w-md w-full p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-semibold text-graphite">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-steel hover:text-graphite transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          {SHORTCUTS.map(group => (
            <div key={group.group}>
              <div className="text-[10px] text-steel uppercase tracking-wider mb-2 font-mono">
                {group.group}
              </div>
              <div className="space-y-1.5">
                {group.items.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-steel">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, ki) => (
                        <Kbd key={ki}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-black/5 text-[10px] text-steel/70 text-center font-mono">
          Press <Kbd>?</Kbd> anywhere to reopen this help
        </div>
      </div>
    </div>
  )
}
