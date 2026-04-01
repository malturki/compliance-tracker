'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TrendData {
  completed: number
  overdue: number
  total: number
  completionRate: number
}

interface Props {
  trends: {
    last30Days: TrendData
    last60Days: TrendData
    last90Days: TrendData
  }
}

export function CompletionTrendChart({ trends }: Props) {
  const data = [
    {
      period: '90 days ago',
      completionRate: trends.last90Days.completionRate,
      completed: trends.last90Days.completed,
      overdue: trends.last90Days.overdue
    },
    {
      period: '60 days ago',
      completionRate: trends.last60Days.completionRate,
      completed: trends.last60Days.completed,
      overdue: trends.last60Days.overdue
    },
    {
      period: '30 days ago',
      completionRate: trends.last30Days.completionRate,
      completed: trends.last30Days.completed,
      overdue: trends.last30Days.overdue
    }
  ]
  
  return (
    <div className="border border-[#1e2d47] bg-[#0f1629] p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Completion Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
          <XAxis 
            dataKey="period" 
            stroke="#64748b"
            style={{ fontSize: '11px', fill: '#64748b' }}
          />
          <YAxis 
            stroke="#64748b"
            style={{ fontSize: '11px', fill: '#64748b' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#0a0e1a',
              border: '1px solid #1e2d47',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '11px'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          <Line 
            type="monotone" 
            dataKey="completionRate" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Completion Rate (%)"
          />
          <Line 
            type="monotone" 
            dataKey="completed" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Completed On-Time"
          />
          <Line 
            type="monotone" 
            dataKey="overdue" 
            stroke="#ef4444" 
            strokeWidth={2}
            name="Completed Late"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
