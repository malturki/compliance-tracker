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
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Completion Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="period" 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '8px',
              color: '#f1f5f9'
            }}
          />
          <Legend />
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
