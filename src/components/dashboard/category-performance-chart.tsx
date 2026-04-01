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
    <div className="border border-[#1e2d47] bg-[#0f1629] p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Category Performance</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d47" />
          <XAxis 
            dataKey="category" 
            stroke="#64748b"
            style={{ fontSize: '11px', fill: '#64748b' }}
            angle={-45}
            textAnchor="end"
            height={80}
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
          <Bar 
            dataKey="completionRate" 
            fill="#10b981" 
            name="Completion Rate (%)"
          />
          <Bar 
            dataKey="overdue" 
            fill="#ef4444" 
            name="Overdue"
          />
          <Bar 
            dataKey="upcoming" 
            fill="#f59e0b" 
            name="Upcoming"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
