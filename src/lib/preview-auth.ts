export function isPreviewAuthMissing() {
  return (
    process.env.VERCEL_ENV === 'preview' &&
    (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
  )
}

export const PREVIEW_AUTH_MISSING_ERROR =
  'Preview authentication is not configured. Add Google OAuth environment variables to Vercel Preview to test real login.'

export function previewAuthMissingResponse() {
  return {
    error: 'PreviewAuthNotConfigured',
    message: PREVIEW_AUTH_MISSING_ERROR,
  }
}
