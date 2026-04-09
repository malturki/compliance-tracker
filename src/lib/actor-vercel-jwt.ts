import { createRemoteJWKSet, jwtVerify } from 'jose'

// Vercel Deployment Protection SSO signs JWTs accessible via this JWKS endpoint.
// If Vercel changes the shape, this helper fails gracefully and getActor
// falls through to the 'system' branch — no 500s.
const JWKS_URL = new URL('https://vercel.com/.well-known/jwks.json')
const jwks = createRemoteJWKSet(JWKS_URL)

export async function verifyVercelJwt(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwks)
    const email = typeof payload.email === 'string' ? payload.email : null
    return email ? { email } : null
  } catch {
    return null
  }
}
