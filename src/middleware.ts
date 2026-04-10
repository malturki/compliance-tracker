import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthRoute = pathname.startsWith('/api/auth')
  const isCronRoute = pathname.startsWith('/api/cron')

  // Allow auth and cron routes through without session
  if (isAuthRoute || isCronRoute) return NextResponse.next()

  // No session = not authenticated
  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  // Viewer-only: restrict to overview and dashboard pages
  const role = req.auth.user?.role
  const editorOnlyPages = ['/calendar', '/obligations', '/templates', '/activity', '/categories', '/settings']
  if (role === 'viewer' && editorOnlyPages.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  // Block viewer mutations on API routes
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
