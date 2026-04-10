'use client'

import { useSearchParams } from 'next/navigation'
import { Shield, AlertTriangle, ArrowRight } from 'lucide-react'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const isAccessDenied = error === 'AccessDenied'

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        <div className="bg-[#0f1629] border border-[#1e2d47] p-6 text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <h1 className="text-lg font-semibold text-slate-100 mb-2">
            {isAccessDenied ? 'Access Denied' : 'Sign-in Error'}
          </h1>

          <p className="text-sm text-slate-400 mb-6">
            {isAccessDenied
              ? 'Your account is not authorized to access this application. Only accounts from the company workspace can sign in.'
              : 'Something went wrong during sign-in. Please try again.'}
          </p>

          {isAccessDenied && (
            <p className="text-xs text-slate-500 mb-6">
              If you signed in with a personal Google account, try again with your company account.
            </p>
          )}

          <div className="space-y-3">
            <a
              href="/api/auth/signin"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded transition-colors"
            >
              Try another account
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="/api/auth/signout"
              className="block w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Sign out and start over
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-700 mt-4 font-mono">
          Compliance Tracker — Acme Corp
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-slate-500 text-sm font-mono">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
