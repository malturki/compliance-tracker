'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, FileText, Tag, Shield, Sparkles, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard', label: 'Dashboard', icon: TrendingUp },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/obligations', label: 'Obligations', icon: FileText },
  { href: '/templates', label: 'Templates', icon: Sparkles },
  { href: '/categories', label: 'Categories', icon: Tag },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#050b18] border-r border-[#1e2d47] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1e2d47]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">Acme Corp</div>
            <div className="text-[10px] text-amber-500/80 font-mono uppercase tracking-widest">Compliance</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
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
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[#1e2d47]">
        <div className="text-[11px] text-slate-600 font-mono">Acme Corp</div>
        <div className="text-[10px] text-slate-700 mt-0.5">Delaware C-Corp</div>
      </div>
    </aside>
  )
}
