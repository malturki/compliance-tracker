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
      <div className="border border-[#1e2d47] bg-gradient-to-br from-[#1a2332] to-[#1e2741] p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-amber-950/40 border border-amber-900/40 p-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              AI Insights
            </h3>
            <div className="space-y-1.5">
              <div className="h-3 bg-[#1e2d47] rounded animate-pulse"></div>
              <div className="h-3 bg-[#1e2d47] rounded animate-pulse w-5/6"></div>
              <div className="h-3 bg-[#1e2d47] rounded animate-pulse w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="border border-red-900/40 bg-red-950/20 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="bg-red-950/40 border border-red-900/40 p-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-400 mb-1 uppercase tracking-wider">
              Summary Unavailable
            </h3>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="border border-[#1e2d47] bg-gradient-to-br from-[#1a2332] to-[#1e2741] p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="bg-amber-950/40 border border-amber-900/40 p-2 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              {isAI ? 'AI Insights' : 'Compliance Summary'}
            </h3>
            {!isAI && (
              <span className="text-[10px] font-mono text-slate-600 bg-[#1e2d47] px-1.5 py-0.5 uppercase">
                Basic
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {summary}
          </p>
        </div>
      </div>
    </div>
  )
}
