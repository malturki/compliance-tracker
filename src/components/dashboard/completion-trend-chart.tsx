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
    <div className="border border-black/5 bg-white p-4">
      <h3 className="text-sm font-semibold text-graphite mb-3 uppercase tracking-wider">Completion Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 102, 114, 0.12)" />
          <XAxis
            dataKey="period"
            stroke="#5F6672"
            style={{ fontSize: '11px', fill: '#5F6672' }}
          />
          <YAxis
            stroke="#5F6672"
            style={{ fontSize: '11px', fill: '#5F6672' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
              color: '#2B2C2F',
              fontSize: '11px'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#5F6672' }} />
          <Line
            type="monotone"
            dataKey="completionRate"
            stroke="#2B2C2F"
            strokeWidth={2}
            name="Completion Rate (%)"
          />
          <Line
            type="monotone"
            dataKey="completed"
            stroke="#A1B0CF"
            strokeWidth={2}
            name="Completed On-Time"
          />
          <Line
            type="monotone"
            dataKey="overdue"
            stroke="#B45555"
            strokeWidth={2}
            name="Completed Late"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
