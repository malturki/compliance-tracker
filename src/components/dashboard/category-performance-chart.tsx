'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface CategoryMetrics {
  category: string
  total: number
  completed: number
  overdue: number
  upcoming: number
  completionRate: number
}

interface Props {
  categories: CategoryMetrics[]
}

export function CategoryPerformanceChart({ categories }: Props) {
  const data = categories.slice(0, 8).map(c => ({
    category: c.category,
    completionRate: c.completionRate,
    overdue: c.overdue,
    upcoming: c.upcoming
  }))
  
  return (
    <div className="border border-black/5 bg-white p-4">
      <h3 className="text-sm font-semibold text-graphite mb-3 uppercase tracking-wider">Category Performance</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 102, 114, 0.12)" />
          <XAxis
            dataKey="category"
            stroke="#5F6672"
            style={{ fontSize: '11px', fill: '#5F6672' }}
            angle={-45}
            textAnchor="end"
            height={80}
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
          <Bar
            dataKey="completionRate"
            fill="#2B2C2F"
            name="Completion Rate (%)"
          />
          <Bar
            dataKey="overdue"
            fill="#B45555"
            name="Overdue"
          />
          <Bar
            dataKey="upcoming"
            fill="#A1B0CF"
            name="Upcoming"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
