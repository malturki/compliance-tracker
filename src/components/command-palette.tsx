'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Tag,
  Sparkles,
  TrendingUp,
  History,
  Settings,
  AlertTriangle,
  Clock,
  FileSearch,
  HelpCircle,
  Workflow,
} from 'lucide-react'
import { HELP_TOPICS, visibleTopicsForRole, type HelpRole } from '@/data/help-content'

type Obligation = {
  id: string
  title: string
  category: string
  status: string
  nextDueDate: string
}

type RoleLevel = 'viewer' | 'editor' | 'admin'
const ROLE_HIERARCHY: Record<RoleLevel, number> = { viewer: 0, editor: 1, admin: 2 }

const PAGES: { href: string; label: string; icon: typeof FileText; minRole: RoleLevel }[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, minRole: 'viewer' },
  { href: '/dashboard', label: 'Dashboard', icon: TrendingUp, minRole: 'viewer' },
  { href: '/obligations', label: 'Obligations', icon: FileText, minRole: 'editor' },
  { href: '/calendar', label: 'Calendar', icon: Calendar, minRole: 'editor' },
  { href: '/templates', label: 'Templates', icon: Sparkles, minRole: 'editor' },
  { href: '/playbooks', label: 'Playbooks', icon: Workflow, minRole: 'editor' },
  { href: '/activity', label: 'Activity', icon: History, minRole: 'editor' },
  { href: '/categories', label: 'Categories', icon: Tag, minRole: 'editor' },
  { href: '/help', label: 'Help', icon: HelpCircle, minRole: 'viewer' },
  { href: '/settings/users', label: 'Settings: Users', icon: Settings, minRole: 'admin' },
  { href: '/settings/agents', label: 'Settings: Agents', icon: Settings, minRole: 'admin' },
]

const FILTERS: { href: string; label: string; icon: typeof AlertTriangle }[] = [
  { href: '/obligations?status=overdue', label: 'Overdue obligations', icon: AlertTriangle },
  { href: '/obligations?status=upcoming', label: 'Due within 7 days', icon: Clock },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const role = (session?.user?.role ?? 'viewer') as RoleLevel
  const canAccess = (min: RoleLevel) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[min]

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Fetch obligations when palette opens (only for users who can see them)
  useEffect(() => {
    if (!open || !canAccess('editor') || obligations.length > 0) return
    setLoading(true)
    fetch('/api/obligations')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setObligations(Array.isArray(d) ? d : []))
      .catch(() => setObligations([]))
      .finally(() => setLoading(false))
  }, [open, canAccess, obligations.length])

  const go = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const visiblePages = PAGES.filter(p => canAccess(p.minRole))
  const visibleFilters = canAccess('editor') ? FILTERS : []

  // Filter obligations client-side by query (fuzzy case-insensitive substring)
  const q = query.trim().toLowerCase()
  const matchingObligations = q
    ? obligations
        .filter(o => o.title.toLowerCase().includes(q))
        .slice(0, 10)
    : obligations.slice(0, 6)

  const helpTopics = visibleTopicsForRole(role as HelpRole)
  const matchingHelp = q
    ? helpTopics.filter(t => t.title.toLowerCase().includes(q) || t.tldr.toLowerCase().includes(q)).slice(0, 6)
    : []

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false} className="bg-white border-black/5">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={canAccess('editor') ? 'Search obligations, pages, help...' : 'Search pages and help...'}
        />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>
            {loading ? 'Loading...' : 'No results'}
          </CommandEmpty>

          {canAccess('editor') && matchingObligations.length > 0 && (
            <>
              <CommandGroup heading="Obligations">
                {matchingObligations.map(o => (
                  <CommandItem
                    key={o.id}
                    value={`obl-${o.id}-${o.title}`}
                    onSelect={() => go(`/obligations?id=${o.id}`)}
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span className="flex-1 truncate">{o.title}</span>
                    <span className="text-[10px] text-steel font-mono">{o.category}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Pages">
            {visiblePages.map(p => {
              const Icon = p.icon
              return (
                <CommandItem
                  key={p.href}
                  value={`page-${p.label}`}
                  onSelect={() => go(p.href)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.label}
                </CommandItem>
              )
            })}
          </CommandGroup>

          {matchingHelp.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Help">
                {matchingHelp.map(t => (
                  <CommandItem
                    key={t.slug}
                    value={`help-${t.slug}-${t.title}`}
                    onSelect={() => go(`/help#${t.slug}`)}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] text-steel font-mono">{t.category}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {visibleFilters.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Filters">
                {visibleFilters.map(f => {
                  const Icon = f.icon
                  return (
                    <CommandItem
                      key={f.href}
                      value={`filter-${f.label}`}
                      onSelect={() => go(f.href)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {f.label}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
