'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, Calendar, FileText, Tag, Sparkles, TrendingUp, History, Settings, LogOut, Search, HelpCircle, Menu, X as CloseIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_BADGE_CLASSES } from '@/lib/role-colors'

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, minRole: 'viewer' as const },
  { href: '/dashboard', label: 'Dashboard', icon: TrendingUp, minRole: 'viewer' as const },
  { href: '/calendar', label: 'Calendar', icon: Calendar, minRole: 'editor' as const },
  { href: '/obligations', label: 'Obligations', icon: FileText, minRole: 'editor' as const },
  { href: '/templates', label: 'Templates', icon: Sparkles, minRole: 'editor' as const },
  { href: '/activity', label: 'Activity', icon: History, minRole: 'editor' as const },
  { href: '/categories', label: 'Categories', icon: Tag, minRole: 'editor' as const },
  { href: '/help', label: 'Help', icon: HelpCircle, minRole: 'viewer' as const },
]

const ROLE_LEVEL: Record<string, number> = { viewer: 0, editor: 1, admin: 2 }

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role ?? 'viewer'
  // Drawer open state — only relevant on mobile (<lg). On desktop the sidebar
  // is always visible via `lg:translate-x-0` regardless of this state.
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auto-close the drawer on navigation.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close on Esc.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
      {/* Mobile hamburger — fixed top-left, hidden on lg+. */}
      <button
        type="button"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(v => !v)}
        className="fixed top-3 left-3 z-[60] lg:hidden bg-white border border-black/10 rounded-lg p-2 shadow-card text-[#2B2C2F] hover:bg-silicon/[0.18] transition-colors"
      >
        {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Backdrop when drawer is open on mobile. */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden
          className="fixed inset-0 z-40 bg-graphite/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-64 bg-white border-r border-black/5 flex flex-col z-50 transition-transform duration-200',
          // Off-screen on mobile by default, on-screen when drawer is open.
          // On lg+ the sidebar is always visible regardless.
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
        )}
      >
      {/* Left padding reserves space for the mobile hamburger/close button
          that sits at `top-3 left-3` inside the drawer area. On lg+ the
          button is hidden so the extra padding doesn't hurt layout. */}
      <div className="pl-16 pr-5 py-5 lg:pl-5 border-b border-black/5">
        <img
          src="/fast-logo-dark.svg"
          alt="FAST"
          width={146}
          height={52}
          className="h-6 w-auto"
        />
        <div className="text-[10px] text-[#5F6672] font-medium uppercase tracking-[0.18em] mt-1.5">
          Compliance
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {/* Command palette trigger */}
        <button
          onClick={() => {
            // Dispatch a Cmd+K keydown to open the global command palette.
            // Keeps the palette as the single source of truth for open/close.
            const ev = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
            document.dispatchEvent(ev)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#5F6672] hover:text-[#2B2C2F] hover:bg-silicon/[0.18] transition-colors"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[9px] font-mono text-[#5F6672] border border-black/10 rounded px-1 py-0.5">⌘K</kbd>
        </button>
        <div className="h-px bg-black/5 my-1.5 mx-1" />
        {navItems.filter(item => (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[item.minRole] ?? 0)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-light-steel/[0.18] text-[#2B2C2F] font-medium'
                  : 'text-[#5F6672] hover:text-[#2B2C2F] hover:bg-silicon/[0.18]',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
        {role === 'admin' && (
          <Link
            href="/settings/users"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-light-steel/[0.18] text-[#2B2C2F] font-medium'
                : 'text-[#5F6672] hover:text-[#2B2C2F] hover:bg-silicon/[0.18]',
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-black/5">
        {session?.user ? (
          <div className="flex items-center gap-2.5">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full border border-black/10" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-silicon/[0.4] flex items-center justify-center text-xs text-[#2B2C2F] font-mono">
                {session.user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#2B2C2F] truncate">{session.user.name ?? session.user.email}</div>
              <span className={cn('inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded', ROLE_BADGE_CLASSES[role as 'admin' | 'editor' | 'viewer'] ?? ROLE_BADGE_CLASSES.viewer)}>
                {role.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-[#5F6672] hover:text-[#2B2C2F] transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-[#5F6672] font-mono">Not signed in</div>
        )}
        <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-mono text-[#5F6672]">
          <span>Shortcuts</span>
          <div className="flex items-center gap-1">
            <kbd className="border border-black/10 rounded px-1 py-0.5">⌘K</kbd>
            <kbd className="border border-black/10 rounded px-1 py-0.5">?</kbd>
          </div>
        </div>
      </div>
      </aside>
    </>
  )
}
