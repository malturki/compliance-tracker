import { verifyVercelJwt } from './actor-vercel-jwt'

export type Actor = {
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system'
}

function readVercelJwtCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? ''
  // Match any cookie whose name starts with `_vercel_jwt`
  const match = /(?:^|;\s*)(_vercel_jwt[^=]*)=([^;]+)/.exec(cookie)
  return match ? match[2] : null
}

export async function getActor(req: Request): Promise<Actor> {
  // 1. Vercel SSO JWT
  const token = readVercelJwtCookie(req)
  if (token) {
    const verified = await verifyVercelJwt(token)
    if (verified?.email) {
      return { email: verified.email, source: 'sso' }
    }
  }

  // 2. Cron secret
  const auth = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { email: 'cron', source: 'cron' }
  }

  // 3. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  // 4. System fallback
  return { email: 'system', source: 'system' }
}
