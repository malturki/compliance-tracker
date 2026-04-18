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
      <div className="border border-light-steel/[0.24] bg-light-steel/[0.08] p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-light-steel/[0.18] border border-light-steel/40 p-2">
            <Sparkles className="w-4 h-4 text-graphite animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-graphite mb-2 uppercase tracking-wider">
              AI Insights
            </h3>
            <div className="space-y-1.5">
              <div className="h-3 bg-silicon/[0.18] rounded animate-pulse"></div>
              <div className="h-3 bg-silicon/[0.18] rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-silicon/[0.18] rounded animate-pulse w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="border border-danger/40 bg-danger/10 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-danger/20 border border-danger/40 p-2">
            <AlertCircle className="w-4 h-4 text-danger" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-danger mb-1 uppercase tracking-wider">
              Summary Unavailable
            </h3>
            <p className="text-xs text-steel">{error}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="border border-light-steel/[0.24] bg-light-steel/[0.08] p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="bg-light-steel/[0.18] border border-light-steel/40 p-2 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-graphite" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-graphite uppercase tracking-wider">
              {isAI ? 'AI Insights' : 'Compliance Summary'}
            </h3>
            {!isAI && (
              <span className="text-[10px] font-mono text-steel/70 bg-silicon/[0.18] px-1.5 py-0.5 uppercase">
                Basic
              </span>
            )}
          </div>
          <p className="text-xs text-steel leading-relaxed">
            {summary}
          </p>
        </div>
      </div>
    </div>
  )
}
