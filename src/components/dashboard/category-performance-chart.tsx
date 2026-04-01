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
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Category Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="category" 
            stroke="#64748b"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
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
