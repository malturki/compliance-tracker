import { afterEach, describe, expect, it } from 'vitest'
import { PREVIEW_AUTH_MISSING_ERROR, isPreviewAuthMissing, previewAuthMissingResponse } from './preview-auth'

describe('preview auth fallback', () => {
  const originalVercelEnv = process.env.VERCEL_ENV
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercelEnv
    if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId
    if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret
  })

  it('enables only for Vercel previews missing Google OAuth configuration', () => {
    process.env.VERCEL_ENV = 'preview'
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(isPreviewAuthMissing()).toBe(true)

    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    expect(isPreviewAuthMissing()).toBe(false)

    process.env.VERCEL_ENV = 'production'
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(isPreviewAuthMissing()).toBe(false)
  })

  it('returns an explicit configuration error payload', () => {
    expect(previewAuthMissingResponse()).toEqual({
      error: 'PreviewAuthNotConfigured',
      message: PREVIEW_AUTH_MISSING_ERROR,
    })
  })
})
