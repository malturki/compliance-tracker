'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import Link from 'next/link'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { Trash2, RotateCw, Copy, Plus, ExternalLink, ShieldAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ROLE_BADGE_CLASSES, type Role } from '@/lib/role-colors'

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

export default function AgentsSettingsPage() {
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', description: '', role: 'viewer' as string, expiresInDays: 365 })
  const [createdToken, setCreatedToken] = useState<{ token: string; expiresAt: string } | null>(null)

  const SKILL_URL = 'https://compliance-tracker-alturki.vercel.app/.well-known/compliance-tracker-skill'
  const exportCommand = (token: string) => `export COMPLIANCE_TRACKER_TOKEN=${token}`
  const agentPrompt = `Fetch the Compliance Tracker skill at ${SKILL_URL} and follow its instructions. The API token is in the COMPLIANCE_TRACKER_TOKEN environment variable. Confirm you can read the skill and list current obligations.`

  const loadAgents = () => {
    setLoading(true)
    fetch('/api/agents')
      .then(r => { if (!r.ok) throw new Error('Failed to fetch'); return r.json() })
      .then(d => setAgents(d.agents))
      .catch(() =>
        toast.error('Failed to load agents', {
          action: { label: 'Retry', onClick: () => loadAgents() },
        }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

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

  const copyToClipboard = (label: string, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Copied ${label} to clipboard`),
      () => toast.error('Copy failed — select and copy manually'),
    )
  }

  const closeTokenModal = () => {
    setCreatedToken(null)
    setShowCreate(false)
    setNewAgent({ name: '', description: '', role: 'viewer', expiresInDays: 365 })
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
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Agent Management</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">Service accounts with API tokens</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-graphite hover:bg-graphite/90 text-platinum text-xs font-medium rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Agent
        </button>
      </div>

      <SettingsTabs />

      {/* Skill URL — visible at the page level so admins always have it on hand,
          not just inside the create-token modal. */}
      <div className="mt-4 mb-4 bg-white border border-black/5 rounded-card shadow-card p-4 flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="text-[10px] text-steel uppercase tracking-[0.18em] mb-0.5">Agent skill URL</div>
          <div className="text-[10px] text-steel/70">Public, no auth — share with any AI agent</div>
        </div>
        <code className="flex-1 font-mono text-[11px] text-graphite break-all bg-canvas border border-black/5 px-2.5 py-2 rounded-inner">
          {SKILL_URL}
        </code>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => copyToClipboard('skill URL', SKILL_URL)}
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-transparent border border-black/10 text-graphite hover:bg-silicon/[0.18] text-[10px] rounded transition-colors"
          >
            <Copy className="w-3 h-3" /> Copy URL
          </button>
          <a
            href={SKILL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-transparent border border-black/10 text-graphite hover:bg-silicon/[0.18] text-[10px] rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
          <div className="animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-silicon/40 last:border-b-0">
                <div className="flex-1 h-3 bg-silicon/60 rounded max-w-[160px]" />
                <div className="h-5 bg-silicon/60 rounded w-16" />
                <div className="h-3 bg-silicon/60 rounded w-24" />
                <div className="h-3 bg-silicon/60 rounded w-28" />
                <div className="h-3 bg-silicon/60 rounded w-24" />
                <div className="h-6 bg-silicon/60 rounded w-28 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-xs text-steel border border-black/5 bg-white rounded-card p-6 text-center">
          No agents yet. Create one to give an AI agent access to the API.
        </div>
      ) : (
        <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-steel border-b border-black/5">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-left px-3 py-2 font-medium">Token</th>
                <th className="text-left px-3 py-2 font-medium">Expires</th>
                <th className="text-left px-3 py-2 font-medium">Last used</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => {
                const revoked = !!agent.revokedAt
                const expired = new Date(agent.expiresAt) < new Date()
                return (
                  <tr key={agent.id} className={`border-b border-silicon/40 last:border-b-0 hover:bg-silicon/[0.18] ${revoked ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2">
                      <div className={revoked ? 'line-through text-steel' : 'text-graphite'}>{agent.name}</div>
                      {agent.description && <div className="text-[10px] text-steel/70 mt-0.5">{agent.description}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded ${ROLE_BADGE_CLASSES[agent.role as Role] ?? ROLE_BADGE_CLASSES.viewer}`}>
                        {agent.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-steel text-[10px]">{agent.tokenPrefix}...</td>
                    <td className={`px-3 py-2 font-mono ${expired ? 'text-danger' : 'text-steel'}`}>
                      {formatDistanceToNow(new Date(agent.expiresAt), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2 font-mono text-steel">
                      {agent.lastUsedAt ? formatDistanceToNow(new Date(agent.lastUsedAt), { addSuffix: true }) : 'never'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!revoked && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRegenerate(agent.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-transparent border border-black/10 text-graphite hover:bg-silicon/[0.18] text-[10px] rounded transition-colors"
                          >
                            <RotateCw className="w-3 h-3" />
                            Regenerate
                          </button>
                          <button
                            onClick={() => handleRevoke(agent.id, agent.name)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-transparent border border-black/10 text-danger hover:bg-danger/10 text-[10px] rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Revoke
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
        <div className="fixed inset-0 bg-graphite/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-black/5 rounded-card shadow-card max-w-md w-full p-5">
            <h2 className="text-sm font-semibold text-graphite mb-4">Create Agent</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-steel mb-1 block">Name</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g. SlackBot"
                  className="w-full bg-canvas border border-black/5 text-graphite text-xs px-3 py-2 rounded focus:border-light-steel focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-steel mb-1 block">Description (optional)</label>
                <input
                  type="text"
                  value={newAgent.description}
                  onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="What does this agent do?"
                  className="w-full bg-canvas border border-black/5 text-graphite text-xs px-3 py-2 rounded focus:border-light-steel focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-steel mb-1 block">Role</label>
                <select
                  value={newAgent.role}
                  onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                  className="w-full bg-canvas border border-black/5 text-graphite text-xs px-3 py-2 rounded focus:border-light-steel focus:outline-none"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-steel mb-1 block">Expires in</label>
                <select
                  value={newAgent.expiresInDays}
                  onChange={e => setNewAgent({ ...newAgent, expiresInDays: Number(e.target.value) })}
                  className="w-full bg-canvas border border-black/5 text-graphite text-xs px-3 py-2 rounded focus:border-light-steel focus:outline-none"
                >
                  {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={closeTokenModal}
                className="flex-1 px-3 py-2 text-xs text-steel hover:text-graphite transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-3 py-2 bg-graphite hover:bg-graphite/90 text-platinum text-xs font-medium rounded transition-colors"
              >
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {createdToken && (
        <div className="fixed inset-0 bg-graphite/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-black/5 rounded-card shadow-card max-w-lg w-full p-5 my-8">
            <h2 className="text-sm font-semibold text-graphite mb-2">Agent Token</h2>
            <p className="text-danger font-semibold text-xs mb-3">
              Copy this token now. It will never be shown again.
            </p>
            <div className="bg-canvas border border-black/5 rounded-inner p-3 font-mono text-[11px] text-graphite break-all mb-2">
              {createdToken.token}
            </div>
            <button
              onClick={() => copyToClipboard('token', createdToken.token)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-graphite hover:bg-graphite/90 text-platinum text-xs font-medium rounded transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Token
            </button>

            {/* Instructions */}
            <div className="mt-5 pt-4 border-t border-black/5">
              <h3 className="text-xs font-semibold text-graphite uppercase tracking-wider mb-3">How to use this token</h3>

              {/* Step 1: Export */}
              <div className="mb-4">
                <div className="text-xs text-steel mb-1.5">
                  <span className="text-steel/70 font-mono">1.</span> Export the token in your shell:
                </div>
                <div className="bg-canvas border border-black/5 rounded-inner p-2.5 font-mono text-[11px] text-graphite break-all mb-1.5">
                  {exportCommand(createdToken.token)}
                </div>
                <button
                  onClick={() => copyToClipboard('export command', exportCommand(createdToken.token))}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-transparent border border-black/10 text-graphite hover:bg-silicon/[0.18] text-[11px] rounded transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy command
                </button>
              </div>

              {/* Step 2: Agent prompt */}
              <div className="mb-3">
                <div className="text-xs text-steel mb-1.5">
                  <span className="text-steel/70 font-mono">2.</span> Paste this into your AI agent:
                </div>
                <div className="bg-canvas border border-black/5 rounded-inner p-2.5 text-[11px] text-graphite mb-1.5 leading-relaxed">
                  {agentPrompt}
                </div>
                <button
                  onClick={() => copyToClipboard('prompt', agentPrompt)}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-transparent border border-black/10 text-graphite hover:bg-silicon/[0.18] text-[11px] rounded transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy prompt
                </button>
              </div>

              <div className="text-[10px] text-steel leading-relaxed">
                The prompt references <span className="font-mono text-graphite">COMPLIANCE_TRACKER_TOKEN</span>, not the raw token — safer to paste into chat history.
              </div>

              <a
                href={SKILL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-steel hover:text-graphite transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                View skill
              </a>
            </div>

            <button
              onClick={closeTokenModal}
              className="w-full mt-4 px-3 py-2 text-xs text-steel hover:text-graphite transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
