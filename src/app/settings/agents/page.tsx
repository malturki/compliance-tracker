'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { Trash2, RotateCw, Copy, Plus, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Agent = {
  id: string
  name: string
  description: string | null
  role: string
  tokenPrefix: string
  createdBy: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

const ROLES = ['viewer', 'editor', 'admin'] as const
const EXPIRY_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '180 days', value: 180 },
  { label: '365 days', value: 365 },
]

const roleBadgeColors: Record<string, string> = {
  admin: 'text-red-400 bg-red-950/50 border-red-800/50',
  editor: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
  viewer: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
}

export default function AgentsSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', description: '', role: 'viewer' as string, expiresInDays: 365 })
  const [createdToken, setCreatedToken] = useState<{ token: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (session?.user?.role !== 'admin') {
      router.push('/')
      return
    }
    fetch('/api/agents')
      .then(r => { if (!r.ok) throw new Error('Failed to fetch'); return r.json() })
      .then(d => setAgents(d.agents))
      .catch(() => toast.error('Failed to load agents'))
      .finally(() => setLoading(false))
  }, [session, router])

  const refreshAgents = async () => {
    const listRes = await fetch('/api/agents')
    const listData = await listRes.json()
    setAgents(listData.agents)
  }

  const handleCreate = async () => {
    if (!newAgent.name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newAgent),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }
      const data = await res.json()
      setCreatedToken({ token: data.token, expiresAt: data.expiresAt })
      await refreshAgents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create agent')
    }
  }

  const handleRegenerate = async (id: string) => {
    if (!confirm('Regenerating invalidates the existing token immediately. Continue?')) return
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'PUT' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to regenerate')
      }
      const data = await res.json()
      setCreatedToken({ token: data.token, expiresAt: data.expiresAt })
      await refreshAgents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate')
    }
  }

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Permanently revoke "${name}"? Revoked agents cannot be restored.`)) return
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Agent revoked')
      await refreshAgents()
    } catch {
      toast.error('Failed to revoke agent')
    }
  }

  const copyToken = () => {
    if (!createdToken) return
    navigator.clipboard.writeText(createdToken.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const closeTokenModal = () => {
    setCreatedToken(null)
    setShowCreate(false)
    setNewAgent({ name: '', description: '', role: 'viewer', expiresInDays: 365 })
  }

  if (session?.user?.role !== 'admin') return null

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Agent Management</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Service accounts with API tokens</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Agent
        </button>
      </div>

      <SettingsTabs />

      {loading ? (
        <div className="text-xs text-slate-500 font-mono">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-xs text-slate-500 border border-[#1e2d47] bg-[#0f1629] p-6 text-center">
          No agents yet. Create one to give an AI agent access to the API.
        </div>
      ) : (
        <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47] text-slate-500">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Token</th>
                <th className="text-left px-3 py-2 font-medium">Expires</th>
                <th className="text-left px-3 py-2 font-medium">Last used</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => {
                const revoked = !!agent.revokedAt
                const expired = new Date(agent.expiresAt) < new Date()
                return (
                  <tr key={agent.id} className={`border-b border-[#1e2d47]/50 ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'} ${revoked ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2">
                      <div className={revoked ? 'line-through text-slate-500' : 'text-slate-300'}>{agent.name}</div>
                      {agent.description && <div className="text-[10px] text-slate-600 mt-0.5">{agent.description}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded ${roleBadgeColors[agent.role] ?? roleBadgeColors.viewer}`}>
                        {agent.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{agent.tokenPrefix}...</td>
                    <td className={`px-3 py-2 font-mono ${expired ? 'text-red-400' : 'text-slate-500'}`}>
                      {formatDistanceToNow(new Date(agent.expiresAt), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {agent.lastUsedAt ? formatDistanceToNow(new Date(agent.lastUsedAt), { addSuffix: true }) : 'never'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!revoked && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRegenerate(agent.id)}
                            className="text-slate-500 hover:text-amber-400 transition-colors"
                            title="Regenerate token"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRevoke(agent.id, agent.name)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                            title="Revoke agent"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && !createdToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1629] border border-[#1e2d47] max-w-md w-full p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-4">Create Agent</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g. SlackBot"
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Description (optional)</label>
                <input
                  type="text"
                  value={newAgent.description}
                  onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="What does this agent do?"
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Role</label>
                <select
                  value={newAgent.role}
                  onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Expires in</label>
                <select
                  value={newAgent.expiresInDays}
                  onChange={e => setNewAgent({ ...newAgent, expiresInDays: Number(e.target.value) })}
                  className="w-full bg-[#0a0e1a] border border-[#1e2d47] text-slate-200 text-xs px-3 py-2 rounded focus:border-amber-500/50 focus:outline-none"
                >
                  {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={closeTokenModal}
                className="flex-1 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors"
              >
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {createdToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f1629] border border-[#1e2d47] max-w-lg w-full p-5">
            <h2 className="text-sm font-semibold text-slate-100 mb-2">Agent Token</h2>
            <p className="text-xs text-amber-400 mb-4">
              Copy this token now. It will never be shown again.
            </p>
            <div className="bg-[#0a0e1a] border border-[#1e2d47] rounded p-3 font-mono text-[11px] text-slate-200 break-all mb-3">
              {createdToken.token}
            </div>
            <button
              onClick={copyToken}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded transition-colors mb-3"
            >
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Token</>}
            </button>
            <button
              onClick={closeTokenModal}
              className="w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
