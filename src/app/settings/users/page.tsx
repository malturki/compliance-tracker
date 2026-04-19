'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { SettingsTabs } from '@/components/settings/settings-tabs'

type User = {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
  createdAt: string
}

const ROLES = ['viewer', 'editor', 'admin'] as const
const ROLE_LEVEL: Record<string, number> = { viewer: 0, editor: 1, admin: 2 }

export default function UsersSettingsPage() {
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = () => {
    setLoading(true)
    fetch('/api/users')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then(d => setUsers(d.users))
      .catch(() =>
        toast.error('Failed to load users', {
          action: { label: 'Retry', onClick: () => loadUsers() },
        }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const handleRoleChange = async (userId: string, newRole: string) => {
    const user = users.find(u => u.id === userId)
    if (!user) return

    // Confirm demotions (lowering privilege level)
    const oldLevel = ROLE_LEVEL[user.role] ?? 0
    const newLevel = ROLE_LEVEL[newRole] ?? 0
    if (newLevel < oldLevel) {
      const who = user.name ?? user.email
      const confirmed = confirm(
        `Demote ${who} from ${user.role} to ${newRole}? They will lose ${user.role}-level access immediately.`,
      )
      if (!confirmed) return
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)))
      toast.success('Role updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  if (status === 'authenticated' && !isAdmin) {
    return (
      <div className="p-6 max-w-[1400px]">
        <div className="flex items-baseline mb-6 border-b border-black/5 pb-4">
          <div>
            <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Settings</h1>
            <p className="text-xs text-steel mt-0.5 font-mono">Admin-only area</p>
          </div>
        </div>
        <div className="bg-white border border-black/5 rounded-card shadow-card p-8 text-center max-w-lg mx-auto mt-12">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-light-steel/[0.18] border border-light-steel/40 mb-4">
            <ShieldAlert className="w-5 h-5 text-graphite" />
          </div>
          <h2 className="text-sm font-semibold text-graphite mb-2">Admin access required</h2>
          <p className="text-xs text-steel leading-relaxed mb-5">
            Your role is <span className="font-mono text-graphite">{session?.user?.role?.toUpperCase() ?? 'UNKNOWN'}</span>. Only admins can manage users and agents. Contact an admin if you need elevated access.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 border border-black/5 hover:border-light-steel text-graphite text-xs font-medium rounded transition-colors"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">User Management</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">Manage roles and access</p>
        </div>
        <div className="text-xs font-mono text-steel">{users.length} users</div>
      </div>

      <SettingsTabs />

      {loading ? (
        <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
          <div className="animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-silicon/40 last:border-b-0">
                <div className="w-6 h-6 rounded-full bg-silicon/60" />
                <div className="flex-1 h-3 bg-silicon/60 rounded max-w-[200px]" />
                <div className="h-3 bg-silicon/60 rounded w-40" />
                <div className="h-6 bg-silicon/60 rounded w-20" />
                <div className="h-3 bg-silicon/60 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-steel border-b border-black/5">
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-right px-3 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-silicon/40 last:border-b-0 hover:bg-silicon/[0.18]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {user.image ? (
                        <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-silicon/50 flex items-center justify-center text-[10px] text-steel font-mono">
                          {user.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-graphite">{user.name ?? 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-steel">{user.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className="bg-white border border-black/5 text-graphite text-xs px-2 py-1 rounded focus:border-light-steel focus:outline-none"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-steel">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
