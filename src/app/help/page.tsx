'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { HELP_TOPICS, visibleTopicsForRole, type HelpRole, type HelpTopic } from '@/data/help-content'
import { ROLE_BADGE_CLASSES } from '@/lib/role-colors'

const CATEGORY_ORDER: HelpTopic['category'][] = [
  'Getting Started',
  'Using the App',
  'Administration',
]

export default function HelpPage() {
  const { data: session, status } = useSession()
  const role = (session?.user?.role ?? 'viewer') as HelpRole
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  // Auto-expand and scroll to the topic named in the URL hash (e.g. /help#faq).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (!hash) return
      setExpanded(prev => {
        if (prev.has(hash)) return prev
        const next = new Set(prev)
        next.add(hash)
        return next
      })
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const topics = useMemo(() => {
    const visible = status === 'authenticated' ? visibleTopicsForRole(role) : HELP_TOPICS.filter(t => t.minRole === 'viewer')
    if (!query.trim()) return visible
    const q = query.toLowerCase()
    return visible.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.tldr.toLowerCase().includes(q) ||
        t.details.toLowerCase().includes(q),
    )
  }, [role, status, query])

  const grouped = useMemo(() => {
    const map = new Map<HelpTopic['category'], HelpTopic[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const t of topics) map.get(t.category)?.push(t)
    return map
  }, [topics])

  function toggle(slug: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(topics.map(t => t.slug)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-graphite" />
            Help
          </h1>
          <p className="text-xs text-steel mt-0.5 font-mono">
            In-app documentation — scoped to your role ({role.toUpperCase()})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-[11px] font-mono text-steel hover:text-graphite border border-black/5 rounded px-2 py-1"
          >
            expand all
          </button>
          <button
            onClick={collapseAll}
            className="text-[11px] font-mono text-steel hover:text-graphite border border-black/5 rounded px-2 py-1"
          >
            collapse all
          </button>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search help topics..."
          className="w-full bg-white border border-black/5 rounded px-3 py-2 text-sm text-graphite placeholder:text-steel/70 focus:outline-none focus:border-light-steel"
        />
      </div>

      {topics.length === 0 ? (
        <div className="text-xs text-steel border border-black/5 bg-white p-6 text-center">
          No topics match your search.
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORY_ORDER.map(category => {
            const items = grouped.get(category) ?? []
            if (items.length === 0) return null
            return (
              <section key={category}>
                <h2 className="text-[11px] font-mono uppercase tracking-widest text-steel mb-3">
                  {category}
                </h2>
                <div className="space-y-2">
                  {items.map(topic => {
                    const isOpen = expanded.has(topic.slug)
                    return (
                      <div
                        key={topic.slug}
                        id={topic.slug}
                        className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden"
                      >
                        <button
                          onClick={() => toggle(topic.slug)}
                          className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-silicon/[0.18] transition-colors"
                        >
                          <ChevronDown
                            className={`w-4 h-4 mt-0.5 text-steel flex-shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-graphite">{topic.title}</h3>
                              <span
                                className={`inline-flex px-1.5 py-0.5 text-[9px] font-mono font-semibold border rounded ${ROLE_BADGE_CLASSES[topic.minRole]}`}
                              >
                                {topic.minRole.toUpperCase()}+
                              </span>
                            </div>
                            <p className="text-xs text-steel leading-relaxed">{topic.tldr}</p>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 pt-1 border-t border-black/5">
                            <HelpDetails markdown={topic.details} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Block =
  | { type: 'paragraph'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; content: string }

function splitBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', items })
      continue
    }
    const paraLines: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !/^\s*-\s+/.test(lines[i]) && !lines[i].trim().startsWith('```')) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', content: paraLines.join(' ') })
  }
  return blocks
}

function HelpDetails({ markdown }: { markdown: string }) {
  const blocks = splitBlocks(markdown)
  return (
    <div className="space-y-3 pt-3 text-xs text-steel leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="bg-canvas border border-black/5 rounded px-3 py-2 text-[11px] font-mono text-graphite overflow-x-auto"
            >
              {block.content}
            </pre>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="space-y-1 list-none pl-0">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-steel flex-shrink-0">•</span>
                  <span className="flex-1">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="text-steel">
            {renderInline(block.content)}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.startsWith('**') && tok.endsWith('**')) {
          return (
            <strong key={i} className="text-graphite font-medium">
              {tok.slice(2, -2)}
            </strong>
          )
        }
        if (tok.startsWith('`') && tok.endsWith('`')) {
          return (
            <code key={i} className="bg-canvas border border-black/5 rounded px-1 py-0.5 text-[11px] font-mono text-graphite">
              {tok.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{tok}</span>
      })}
    </>
  )
}
