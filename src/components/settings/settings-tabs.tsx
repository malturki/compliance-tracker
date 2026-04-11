'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/settings/users', label: 'Users' },
  { href: '/settings/agents', label: 'Agents' },
]

export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-[#1e2d47] mb-6">
      {tabs.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              active
                ? 'text-amber-400 border-amber-500'
                : 'text-slate-500 border-transparent hover:text-slate-300',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
