// Diagnostic preview — renders the RiskExposureChart with sample data on a
// public (bypass-listed) route so we can visually verify what the live client
// bundle actually paints. To be removed after debugging.
import { RiskExposureChart } from '@/components/dashboard/risk-exposure-chart'
import { RISK_COLORS } from '@/components/dashboard/risk-colors'

export const dynamic = 'force-dynamic'

export default function DebugChartPreview() {
  const risks = [
    { riskLevel: 'critical', total: 1, overdue: 0, upcoming: 0, percentage: 2 },
    { riskLevel: 'high', total: 18, overdue: 0, upcoming: 0, percentage: 36 },
    { riskLevel: 'medium', total: 20, overdue: 0, upcoming: 0, percentage: 41 },
    { riskLevel: 'low', total: 10, overdue: 0, upcoming: 0, percentage: 20 },
  ]

  return (
    <div style={{ background: '#F6F8FA', minHeight: '100vh', padding: 40, fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#2B2C2F' }}>Debug: Risk Exposure Chart Preview</h1>
      <p style={{ color: '#5F6672', fontSize: 12 }}>
        Expected colors: critical = red, high = amber, medium = steel, low = green.
      </p>
      <pre style={{ background: '#FFFFFF', padding: 12, fontSize: 11, border: '1px solid rgba(0,0,0,0.05)' }}>
        {JSON.stringify(RISK_COLORS, null, 2)}
      </pre>
      <div style={{ maxWidth: 700, marginTop: 24 }}>
        <RiskExposureChart risks={risks} />
      </div>
    </div>
  )
}
