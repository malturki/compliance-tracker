'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { CompletionTrendChart } from '@/components/dashboard/completion-trend-chart'
import { CategoryPerformanceChart } from '@/components/dashboard/category-performance-chart'
import { RiskExposureChart } from '@/components/dashboard/risk-exposure-chart'
import { OwnerPerformanceTable } from '@/components/dashboard/owner-performance-table'
import { AISummaryWidget } from '@/components/dashboard/ai-summary-widget'
import { useSession } from 'next-auth/react'
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react'

interface AnalyticsData {
  overview: {
    totalObligations: number
    overdueCount: number
    dueThisWeek: number
    complianceScore: number
    completionRate: number
  }
  trends: any
  categoryPerformance: any[]
  ownerPerformance: any[]
  riskExposure: any[]
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const isViewer = session?.user?.role === 'viewer'
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = new Date()

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/analytics')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-graphite animate-spin mx-auto mb-4" />
          <p className="text-steel">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-graphite mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-steel">{error || 'Unknown error'}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-graphite text-platinum hover:bg-graphite/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { overview } = analytics

  return (
    <div className="p-6 max-w-[1400px] overflow-x-hidden">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Analytics Dashboard</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">AI-powered compliance insights</p>
        </div>
        <div className="text-xs font-mono text-steel">{format(today, 'EEE, MMM d yyyy')}</div>
      </div>

      {/* AI Summary */}
      <AISummaryWidget analyticsData={analytics} />

      {/* Metric Cards — 2 columns on mobile, 4 from md upward */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          title="Compliance Score"
          value={`${overview.complianceScore}/100`}
          icon={<TrendingUp className="w-3 h-3" />}
          color={overview.complianceScore >= 90 ? 'green' : overview.complianceScore >= 70 ? 'amber' : 'red'}
          subtitle={`${overview.completionRate}% on-time completion`}
        />

        <MetricCard
          title="Overdue Items"
          value={overview.overdueCount}
          icon={<AlertCircle className="w-3 h-3" />}
          color={overview.overdueCount === 0 ? 'green' : overview.overdueCount <= 3 ? 'amber' : 'red'}
          subtitle="require immediate action"
        />

        <MetricCard
          title="Due This Week"
          value={overview.dueThisWeek}
          icon={<Clock className="w-3 h-3" />}
          color="amber"
          subtitle="within 7 days"
        />

        <MetricCard
          title="Total Obligations"
          value={overview.totalObligations}
          icon={<CheckCircle2 className="w-3 h-3" />}
          color="slate"
          subtitle="being tracked"
        />
      </div>

      {/* Charts Row 1 — stacked on mobile, side-by-side from lg upward */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <CompletionTrendChart trends={analytics.trends} />
        <CategoryPerformanceChart categories={analytics.categoryPerformance} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <RiskExposureChart risks={analytics.riskExposure} />
        <div className="bg-white border border-black/5 rounded-card shadow-card p-6">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-steel mb-3">Key Metrics</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-steel">30-Day Completion Rate</span>
                <span className="text-xs font-mono font-semibold text-graphite">
                  {analytics.trends.last30Days.completionRate}%
                </span>
              </div>
              <div className="w-full bg-silicon/40 h-1.5">
                <div
                  className="bg-success h-1.5"
                  style={{ width: `${analytics.trends.last30Days.completionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-steel">60-Day Completion Rate</span>
                <span className="text-xs font-mono font-semibold text-graphite">
                  {analytics.trends.last60Days.completionRate}%
                </span>
              </div>
              <div className="w-full bg-silicon/40 h-1.5">
                <div
                  className="bg-success h-1.5"
                  style={{ width: `${analytics.trends.last60Days.completionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-steel">90-Day Completion Rate</span>
                <span className="text-xs font-mono font-semibold text-graphite">
                  {analytics.trends.last90Days.completionRate}%
                </span>
              </div>
              <div className="w-full bg-silicon/40 h-1.5">
                <div
                  className="bg-success h-1.5"
                  style={{ width: `${analytics.trends.last90Days.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Performance Table (hidden for viewers) */}
      {!isViewer && <OwnerPerformanceTable owners={analytics.ownerPerformance} />}
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color: 'green' | 'amber' | 'red' | 'slate'
  subtitle?: string
}

function MetricCard({ title, value, icon, color, subtitle }: MetricCardProps) {
  const colorClasses = {
    green: 'border-success/30 text-success/70',
    amber: 'border-warning/30 text-warning/70',
    red: 'border-danger/30 text-danger/70',
    slate: 'border-black/5 text-steel'
  }

  const valueColorClasses = {
    green: 'text-success',
    amber: 'text-warning',
    red: 'text-danger',
    slate: 'text-graphite'
  }

  return (
    <div className={`bg-white border ${colorClasses[color]} rounded-card shadow-card p-4`}>
      <div className="text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
        {icon}{title}
      </div>
      <div className={`text-3xl font-mono font-bold ${valueColorClasses[color]}`}>{value}</div>
      {subtitle && (
        <div className="text-xs text-steel/70 mt-1">{subtitle}</div>
      )}
    </div>
  )
}
