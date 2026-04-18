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

// Severity → color semantics. Each tier gets a distinct FAST token:
//   critical = danger red, high = warning amber, medium = neutral steel,
//   low = success green. Using hue (not just lightness) so the chart stays
//   legible for colorblind users and under small slice widths.
export const COLORS: Record<string, string> = {
  critical: '#B45555', // danger
  high: '#A1620E',     // warning
  medium: '#5F6672',   // steel (neutral)
  low: '#3A6B4F',      // success
}

export function RiskExposureChart({ risks }: Props) {
  const data = risks.map(r => ({
    name: r.riskLevel.charAt(0).toUpperCase() + r.riskLevel.slice(1),
    value: r.total,
    overdue: r.overdue,
    percentage: r.percentage
  }))
  
  return (
    <div className="border border-black/5 bg-white p-4">
      <h3 className="text-sm font-semibold text-graphite mb-3 uppercase tracking-wider">Risk Exposure</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percentage }) => `${name}: ${percentage}%`}
            outerRadius={100}
            fill="#A1B0CF"
            dataKey="value"
            style={{ fontSize: '11px', fill: '#5F6672' }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[entry.name.toLowerCase()] || '#5F6672'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
              color: '#2B2C2F',
              fontSize: '11px'
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value} obligations (${props.payload.overdue} overdue)`,
              name
            ]}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#5F6672' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
