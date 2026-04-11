import { auth } from '@/lib/auth'
import { verifyAgentToken } from '@/lib/agent-auth'
import { NextResponse } from 'next/server'

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const isAuthRoute = pathname.startsWith('/api/auth') || pathname.startsWith('/auth/')
  const isCronRoute = pathname.startsWith('/api/cron')

  if (isAuthRoute || isCronRoute) return NextResponse.next()

  // Agent bearer token path (checked before session)
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const agent = await verifyAgentToken(token)
    if (agent) {
      if (agent.role === 'viewer' && pathname.startsWith('/api/') && req.method !== 'GET') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.next()
    }
    // Header present but invalid — reject immediately
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // NextAuth session path
  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  const role = req.auth.user?.role
  const editorOnlyPages = ['/calendar', '/obligations', '/templates', '/activity', '/categories', '/settings']
  if (role === 'viewer' && editorOnlyPages.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  if (role === 'viewer' && pathname.startsWith('/api/') && req.method !== 'GET') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
