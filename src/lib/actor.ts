import { auth } from './auth'

export type Actor = {
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system' | 'agent'
}

export async function getActor(req?: Request): Promise<Actor> {
  // 1. NextAuth session
  const session = await auth()
  if (session?.user?.email) {
    return { email: session.user.email, source: 'sso' }
  }

  // 2. Cron secret
  if (req) {
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return { email: 'cron', source: 'cron' }
    }
  }

  // 3. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  return { email: 'system', source: 'system' }
}
