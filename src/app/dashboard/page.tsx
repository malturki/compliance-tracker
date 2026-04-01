'use client'

import { useEffect, useState } from 'react'
import { CompletionTrendChart } from '@/components/dashboard/completion-trend-chart'
import { CategoryPerformanceChart } from '@/components/dashboard/category-performance-chart'
import { RiskExposureChart } from '@/components/dashboard/risk-exposure-chart'
import { OwnerPerformanceTable } from '@/components/dashboard/owner-performance-table'
import { AISummaryWidget } from '@/components/dashboard/ai-summary-widget'
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
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
    
    fetchAnalytics()
  }, [])
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    )
  }
  
  if (error || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-slate-600">{error || 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  const { overview } = analytics
  
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Compliance Intelligence Dashboard
        </h1>
        <p className="text-slate-600">
          AI-powered insights and analytics for compliance tracking
        </p>
      </div>
      
      {/* AI Summary */}
      <AISummaryWidget analyticsData={analytics} />
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Compliance Score"
          value={`${overview.complianceScore}/100`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={overview.complianceScore >= 90 ? 'green' : overview.complianceScore >= 70 ? 'amber' : 'red'}
          subtitle={`${overview.completionRate}% on-time completion`}
        />
        
        <MetricCard
          title="Overdue Items"
          value={overview.overdueCount}
          icon={<AlertCircle className="w-5 h-5" />}
          color={overview.overdueCount === 0 ? 'green' : overview.overdueCount <= 3 ? 'amber' : 'red'}
          subtitle="Needs immediate attention"
        />
        
        <MetricCard
          title="Due This Week"
          value={overview.dueThisWeek}
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
          subtitle="Upcoming deadlines"
        />
        
        <MetricCard
          title="Total Obligations"
          value={overview.totalObligations}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="slate"
          subtitle="Being tracked"
        />
      </div>
      
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompletionTrendChart trends={analytics.trends} />
        <CategoryPerformanceChart categories={analytics.categoryPerformance} />
      </div>
      
      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskExposureChart risks={analytics.riskExposure} />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">30-Day Completion Rate</span>
                <span className="text-sm font-semibold text-slate-900">
                  {analytics.trends.last30Days.completionRate}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${analytics.trends.last30Days.completionRate}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">60-Day Completion Rate</span>
                <span className="text-sm font-semibold text-slate-900">
                  {analytics.trends.last60Days.completionRate}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${analytics.trends.last60Days.completionRate}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">90-Day Completion Rate</span>
                <span className="text-sm font-semibold text-slate-900">
                  {analytics.trends.last90Days.completionRate}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${analytics.trends.last90Days.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Owner Performance Table */}
      <OwnerPerformanceTable owners={analytics.ownerPerformance} />
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color: 'green' | 'amber' | 'red' | 'blue' | 'slate'
  subtitle?: string
}

function MetricCard({ title, value, icon, color, subtitle }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    slate: 'bg-slate-100 text-slate-700'
  }
  
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mb-1">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
      </div>
      {subtitle && (
        <p className="text-sm text-slate-500">{subtitle}</p>
      )}
    </div>
  )
}
