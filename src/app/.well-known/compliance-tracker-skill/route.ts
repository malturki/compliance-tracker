import { COMPLIANCE_TRACKER_SKILL } from '@/lib/compliance-tracker-skill'

export const dynamic = 'force-static'

export async function GET() {
  return new Response(COMPLIANCE_TRACKER_SKILL, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}
