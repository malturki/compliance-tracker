import { handlers } from '@/lib/auth'
import { isPreviewAuthMissing, previewAuthMissingResponse } from '@/lib/preview-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  if (isPreviewAuthMissing()) {
    const { pathname } = new URL(request.url)
    if (pathname.endsWith('/session')) {
      return NextResponse.json(null)
    }
    if (pathname.endsWith('/signin')) {
      return NextResponse.json(previewAuthMissingResponse(), { status: 503 })
    }
  }

  return handlers.GET(request)
}

export const { POST } = handlers
