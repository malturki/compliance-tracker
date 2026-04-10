# Auth & Access Control — Design Spec

**Date:** 2026-04-10
**Status:** Draft for review
**Scope:** Add Google OAuth authentication via NextAuth.js v5, role-based access control (viewer/editor/admin), user management page, and replace Vercel Deployment Protection SSO.

## Goal

Restrict the compliance tracker to authenticated users from a specific Google Workspace domain. Assign roles (viewer, editor, admin) so that only authorized users can modify data. Provide an admin UI for managing user roles.

## Non-goals

- Multi-tenancy or multi-org support. Single company, single domain.
- Linking obligation owner/assignee fields to user records. They remain free-text for now.
- Social login providers beyond Google.
- Fine-grained per-category or per-obligation permissions.
- Email/password login.
- Two-factor authentication (Google handles this at the IDP level).

## Auth flow

NextAuth.js v5 (Auth.js) with the Google provider. One Google Cloud OAuth 2.0 app, restricted to the company's Google Workspace domain.

### Login sequence

1. User visits any page → Next.js middleware checks for a valid session cookie.
2. No session → redirect to `/api/auth/signin` → Google OAuth consent screen.
3. Google returns email, name, avatar → NextAuth `signIn` callback validates the email domain against `GOOGLE_ALLOWED_DOMAIN` env var. Rejects non-matching domains.
4. First-time user → new row in `users` table. Role defaults to `viewer`. Exception: the very first user to sign in becomes `admin`.
5. Returning user → session restored from JWT cookie; user row looked up for current role.
6. Session JWT contains `{ userId, email, name, image, role }`.

### Session strategy

JWT (stateless). No server-side session table. The signed cookie works across all Vercel serverless instances. Role is read from the `users` table at sign-in and embedded in the token.

If an admin changes a user's role, it takes effect on the user's next sign-in. Acceptable latency for a small-team tool.

### Domain restriction

Enforced in the NextAuth `signIn` callback. The allowed domain is read from the `GOOGLE_ALLOWED_DOMAIN` env var (e.g., `acme.com`). Emails not matching `@{domain}` are rejected with an error message. This is not hardcoded so the app remains portable.

## Data model

One new table:

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                    // ulid
  email: text('email').notNull().unique(),
  name: text('name'),                             // from Google profile
  image: text('image'),                           // Google avatar URL
  role: text('role').notNull().default('viewer'),  // 'viewer' | 'editor' | 'admin'
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

No changes to `obligations`, `completions`, or `audit_log` schemas. The `owner`, `assignee`, and `completedBy` fields remain free-text strings.

### Migration

- Add `users` table to `src/db/schema.ts`.
- Add `CREATE TABLE IF NOT EXISTS users (...)` to the in-memory init in `src/db/index.ts` (for local dev without Turso).
- Create the table on Turso via `turso db shell`.
- No data backfill. Users are created on first sign-in.

## Middleware (route protection)

New file `src/middleware.ts` using NextAuth's built-in middleware export:

```ts
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    '/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Route protection rules

- **All pages and API routes** require authentication (session cookie present and valid).
- **`/api/auth/*`** routes are excluded — the login flow itself must be accessible.
- **`/api/cron/*`** routes are excluded — they use `CRON_SECRET` Bearer token auth, not user sessions.
- **Unauthenticated page requests** → redirect to `/api/auth/signin`.
- **Unauthenticated API requests** → return `401 Unauthorized`.

## Permission enforcement

### Role hierarchy

```
viewer (0) < editor (1) < admin (2)
```

### Helper

```ts
type Role = 'viewer' | 'editor' | 'admin'

export function requireRole(session: Session, minRole: Role): void
```

Throws a `ForbiddenError` (mapped to HTTP 403) if the session user's role is below `minRole`.

### Route permissions

| Action | Minimum role | Routes |
|---|---|---|
| View any data | `viewer` | All GET endpoints |
| Create/update/delete obligations | `editor` | POST/PUT/DELETE `/api/obligations/*` |
| Mark obligation complete | `editor` | POST `/api/obligations/[id]/complete` |
| Bulk operations | `editor` | POST `/api/obligations/bulk` |
| Apply template | `editor` | POST `/api/templates` |
| View users | `admin` | GET `/api/users` |
| Change user roles | `admin` | PUT `/api/users/[id]` |

### UI enforcement

- Editor-only actions (create, edit, complete, delete buttons) are hidden for viewers via conditional rendering.
- The session with role is available to client components via NextAuth's `SessionProvider` and `useSession()`.
- Attempting a forbidden action via direct API call returns 403 with `{ error: "Forbidden" }`.

## Admin settings page

New page at `/settings/users`, accessible only to `admin` role.

### Features

- Table of all users: email, name, role, joined date.
- Dropdown to change any user's role (viewer/editor/admin).
- Cannot demote the last remaining admin (prevents lockout).
- Role changes are recorded in the audit log as `user.role_changed` events with a diff (`{ role: ['viewer', 'editor'] }`).

### Navigation

- "Settings" entry in the sidebar, visible only to admins.
- Uses a gear icon from lucide-react, placed below "Categories" in the nav.

## API routes

### New routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth.js handler (auto-generated) |
| `/api/users` | GET | List all users (admin only) |
| `/api/users/[id]` | PUT | Update user role (admin only) |

### Modified routes

All existing API routes that mutate data gain a `requireRole(session, 'editor')` check at the top. GET routes gain `requireRole(session, 'viewer')` (effectively just "must be authenticated" since all roles are >= viewer).

## getActor() migration

The existing `getActor()` helper (`src/lib/actor.ts`) is simplified:

```ts
export async function getActor(req: Request): Promise<Actor> {
  // 1. NextAuth session (primary)
  const session = await auth()
  if (session?.user?.email) {
    return { email: session.user.email, source: 'sso' }
  }

  // 2. Cron secret (for /api/cron/* routes)
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { email: 'cron', source: 'cron' }
  }

  // 3. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  return { email: 'system', source: 'system' }
}
```

The `Actor` type and `source` field stay the same. The audit log continues to store `actor.email` — which is now always a real Google email for user-initiated actions.

### Removed

- `src/lib/actor-vercel-jwt.ts` — Vercel JWT verification, no longer needed.
- `jose` npm dependency — only used for Vercel JWT verification.

## Removing Vercel Deployment Protection

After auth is live and verified end-to-end:

1. Disable Deployment Protection in Vercel dashboard: Settings → Deployment Protection → set to "Standard Protection" (only preview deployments protected, production is open).
2. The app's own auth middleware handles all access control from this point.
3. Remove `src/lib/actor-vercel-jwt.ts` and the `jose` dependency.

## Layout and session provider

`src/app/layout.tsx` wraps the app in NextAuth's `SessionProvider`:

```tsx
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'

export default async function RootLayout({ children }) {
  const session = await auth()
  return (
    <SessionProvider session={session}>
      {/* existing layout */}
    </SessionProvider>
  )
}
```

Client components access the session via `useSession()` to conditionally render UI based on role.

The sidebar footer (currently showing "Acme Corp / Delaware C-Corp") adds a user section: avatar, name, role badge, sign-out link.

## Env vars

| Variable | Purpose | Example |
|---|---|---|
| `NEXTAUTH_SECRET` | Signs the session JWT | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical app URL | `https://compliance-tracker-alturki.vercel.app` |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 client ID | `123456.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | `GOCSPX-...` |
| `GOOGLE_ALLOWED_DOMAIN` | Company Google Workspace domain | `acme.com` |

### Google Cloud Console setup (one-time)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID (Web application type).
3. Add authorized redirect URI: `https://compliance-tracker-alturki.vercel.app/api/auth/callback/google`.
4. Copy the client ID and secret into Vercel env vars.

## New audit event type

One new event type added to the audit log:

| Type | When | diff | metadata |
|---|---|---|---|
| `user.role_changed` | Admin changes a user's role | `{ role: ['viewer', 'editor'] }` | `{ userId, email }` |

## Testing

### Unit tests

- `requireRole()` — each role combination, hierarchy enforcement, forbidden error.
- NextAuth callbacks — domain validation (accept matching, reject non-matching, reject no-domain).

### Integration tests

- Sign-in flow: mock Google provider, verify user created in DB with correct default role.
- First user gets admin role.
- Viewer cannot POST to `/api/obligations` (403).
- Editor can POST to `/api/obligations` (201).
- Admin can PUT `/api/users/[id]` to change roles.
- Last admin cannot be demoted (400 error).
- Cron routes still work with Bearer token (no session needed).

## Risks and open questions

- **NextAuth v5 stability.** Auth.js v5 is the current stable release for App Router. The API is mature but the ecosystem has historically had breaking changes between major versions. Pin the version.
- **JWT role staleness.** If an admin changes a user's role, the change takes effect on next sign-in. For a small team this is acceptable. If it becomes an issue, we can reduce `jwt.maxAge` or add a role-refresh callback.
- **Google OAuth app verification.** For internal-only apps restricted to a Google Workspace domain, Google does not require OAuth app verification. The consent screen shows "unverified app" warning only for external users (which we reject anyway).
- **Local development.** Dev without Google OAuth credentials falls through to the existing `DEV_ACTOR` env var fallback, so developers can work without configuring Google Cloud. The middleware skips auth checks when `NODE_ENV !== 'production'` and no NextAuth secret is configured.

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next-auth` | `^5` | Auth framework |
| `@auth/drizzle-adapter` | `^1` | Optional — only if we switch from JWT to DB sessions later |

Remove: `jose` (Vercel JWT verification, no longer needed).
