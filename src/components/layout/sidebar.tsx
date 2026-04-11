'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, Calendar, FileText, Tag, Shield, Sparkles, TrendingUp, History, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, minRole: 'viewer' as const },
  { href: '/dashboard', label: 'Dashboard', icon: TrendingUp, minRole: 'viewer' as const },
  { href: '/calendar', label: 'Calendar', icon: Calendar, minRole: 'editor' as const },
  { href: '/obligations', label: 'Obligations', icon: FileText, minRole: 'editor' as const },
  { href: '/templates', label: 'Templates', icon: Sparkles, minRole: 'editor' as const },
  { href: '/activity', label: 'Activity', icon: History, minRole: 'editor' as const },
  { href: '/categories', label: 'Categories', icon: Tag, minRole: 'editor' as const },
]

const ROLE_LEVEL: Record<string, number> = { viewer: 0, editor: 1, admin: 2 }

const roleBadgeColors: Record<string, string> = {
  admin: 'text-red-400 bg-red-950/50 border-red-800/50',
  editor: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
  viewer: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role ?? 'viewer'

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#050b18] border-r border-[#1e2d47] flex flex-col z-50">
      <div className="px-5 py-4 border-b border-[#1e2d47]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">Pi Squared Inc.</div>
            <div className="text-[10px] text-amber-500/80 font-mono uppercase tracking-widest">Compliance</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.filter(item => (ROLE_LEVEL[role] ?? 0) >= (ROLE_LEVEL[item.minRole] ?? 0)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors',
                active
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1629]',
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
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1629]',
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-[#1e2d47]">
        {session?.user ? (
          <div className="flex items-center gap-2.5">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full border border-[#1e2d47]" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1e2d47] flex items-center justify-center text-xs text-slate-400 font-mono">
                {session.user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 truncate">{session.user.name ?? session.user.email}</div>
              <span className={cn('inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded', roleBadgeColors[role] ?? roleBadgeColors.viewer)}>
                {role.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-600 font-mono">Not signed in</div>
        )}
      </div>
    </aside>
  )
}
