import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Note: Agent token verification happens inside each API route handler via
// `getActor()` + `requireRole()`, not here. The libsql client used by
// verifyAgentToken() requires Node APIs and cannot run in Edge Runtime
// (where middleware executes). So here we simply wave Bearer-authenticated
// requests through to the route handler, which then verifies the token in
// the Node serverless function.

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthRoute = pathname.startsWith('/api/auth') || pathname.startsWith('/auth/')
  const isCronRoute = pathname.startsWith('/api/cron')
  const isWellKnownRoute = pathname.startsWith('/.well-known/')
  // Launch assets must be reachable by unauthenticated crawlers (Slack, Twitter,
  // LinkedIn, WhatsApp, search engines). Without this, link previews 307 to
  // sign-in and show nothing instead of the FAST liquid-metal OG card.
  const isLaunchAsset =
    pathname === '/icon.svg' ||
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image')

  if (isAuthRoute || isCronRoute || isWellKnownRoute || isLaunchAsset) return NextResponse.next()

  // If a Bearer token is present, let the request through and let the route
  // handler's requireRole() verify it. Any invalid token will get 401 from
  // the route handler, not from middleware.
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    return NextResponse.next()
  }

  // No Bearer header — use NextAuth session path
  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  const role = req.auth.user?.role
  const editorOnlyPages = ['/calendar', '/obligations', '/templates', '/playbooks', '/catalog', '/activity', '/categories', '/settings']
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
