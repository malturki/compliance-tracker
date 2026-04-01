'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface RiskMetrics {
  riskLevel: string
  total: number
  overdue: number
  upcoming: number
  percentage: number
}

interface Props {
  risks: RiskMetrics[]
}

const COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981'
}

export function RiskExposureChart({ risks }: Props) {
  const data = risks.map(r => ({
    name: r.riskLevel.charAt(0).toUpperCase() + r.riskLevel.slice(1),
    value: r.total,
    overdue: r.overdue,
    percentage: r.percentage
  }))
  
  return (
    <div className="border border-[#1e2d47] bg-[#0f1629] p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">Risk Exposure</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            style={{ fontSize: '11px', fill: '#94a3b8' }}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[entry.name.toLowerCase()] || '#64748b'} 
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: '#0a0e1a',
              border: '1px solid #1e2d47',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '11px'
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value} obligations (${props.payload.overdue} overdue)`,
              name
            ]}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
