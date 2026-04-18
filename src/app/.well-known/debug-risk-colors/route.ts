// Diagnostic endpoint — returns the COLORS map compiled into production.
// Purpose: verify whether Vercel's build is serving the updated chart colors.
// Remove after debugging; kept in middleware bypass via `/.well-known/` prefix.
import { RISK_COLORS } from '@/components/dashboard/risk-colors'

export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(
    JSON.stringify({
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? 'unknown',
      colors: RISK_COLORS,
    }, null, 2),
    { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } },
  )
}
