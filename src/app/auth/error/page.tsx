'use client'

import { useSearchParams } from 'next/navigation'
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const isAccessDenied = error === 'AccessDenied'

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded bg-light-steel/[0.18] border border-light-steel flex items-center justify-center">
            <Shield className="w-6 h-6 text-graphite" />
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-card shadow-card p-8 max-w-md mx-auto">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-danger" />
          </div>

          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite mb-2 text-center">
            {isAccessDenied ? 'Access Denied' : 'Sign-in Error'}
          </h1>

          <p className="text-steel text-sm mb-6 text-center">
            {isAccessDenied
              ? 'Your account is not authorized to access this application. Only accounts from the company workspace can sign in.'
              : 'Something went wrong during sign-in. Please try again.'}
          </p>

          {isAccessDenied && (
            <p className="text-xs text-steel/70 mb-6 text-center">
              If you signed in with a personal Google account, try again with your company account.
            </p>
          )}

          <div className="space-y-3">
            <a
              href="/api/auth/signin"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-graphite hover:bg-graphite/90 text-platinum text-sm font-medium rounded transition-colors"
            >
              Try another account
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="/api/auth/signout"
              className="block w-full px-4 py-2 text-xs text-steel hover:text-graphite transition-colors text-center"
            >
              Sign out and start over
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-steel/70 mt-4 font-mono">
          FAST Compliance Tracker
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-steel text-sm font-mono">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
