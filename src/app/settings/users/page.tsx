'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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

export default function UsersSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.role !== 'admin') {
      router.push('/')
      return
    }
    fetch('/api/users')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then(d => setUsers(d.users))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [session, router])

  const handleRoleChange = async (userId: string, newRole: string) => {
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

  if (session?.user?.role !== 'admin') return null

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">User Management</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Manage roles and access</p>
        </div>
        <div className="text-xs font-mono text-slate-500">{users.length} users</div>
      </div>

      <SettingsTabs />

      {loading ? (
        <div className="text-xs text-slate-500 font-mono">Loading...</div>
      ) : (
        <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47] text-slate-500">
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-right px-3 py-2 font-medium font-mono">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`border-b border-[#1e2d47]/50 ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {user.image ? (
                        <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#1e2d47] flex items-center justify-center text-[10px] text-slate-400 font-mono">
                          {user.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-slate-300">{user.name ?? 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-400">{user.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className="bg-[#0a0e1a] border border-[#1e2d47] text-slate-300 text-xs px-2 py-1 rounded focus:border-amber-500/50 focus:outline-none"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
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
