'use client'

import { useState, useEffect } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'

interface Props {
  analyticsData: any
}

export function AISummaryWidget({ analyticsData }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isAI, setIsAI] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!analyticsData) return
    
    const fetchSummary = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/analytics/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(analyticsData)
        })
        
        if (!response.ok) {
          throw new Error('Failed to generate summary')
        }
        
        const data = await response.json()
        setSummary(data.summary)
        setIsAI(data.isAI)
      } catch (err) {
        console.error('Failed to fetch AI summary:', err)
        setError('Failed to generate summary')
      } finally {
        setLoading(false)
      }
    }
    
    fetchSummary()
  }, [analyticsData])
  
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              AI Insights
            </h3>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
              <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6"></div>
              <div className="h-4 bg-slate-200 rounded animate-pulse w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-100 p-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 mb-1">
              Summary Unavailable
            </h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-100 p-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {isAI ? 'AI Insights' : 'Compliance Summary'}
            </h3>
            {!isAI && (
              <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                Basic
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {summary}
          </p>
        </div>
      </div>
    </div>
  )
}
