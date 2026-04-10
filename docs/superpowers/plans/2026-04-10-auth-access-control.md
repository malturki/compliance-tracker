# Auth & Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth authentication via NextAuth.js v5, role-based access control (viewer/editor/admin), user management page, and remove Vercel Deployment Protection SSO.

**Architecture:** NextAuth.js v5 with Google provider, JWT session strategy, `users` table in Turso for role storage. Next.js middleware protects all routes. A `requireRole()` helper enforces permissions in API handlers. Admin manages users at `/settings/users`.

**Tech Stack:** NextAuth.js v5 (`next-auth@5`), Google OAuth 2.0, Drizzle ORM, Turso (libsql), Next.js 14 App Router, Tailwind, lucide-react.

**Reference spec:** [docs/superpowers/specs/2026-04-10-auth-access-control-design.md](../specs/2026-04-10-auth-access-control-design.md)

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `src/db/schema.ts` | Modify | Add `users` table |
| `src/db/index.ts` | Modify | Add `CREATE TABLE users` to in-memory init |
| `src/lib/auth.ts` | Create | NextAuth.js config (Google provider, callbacks, domain check) |
| `src/lib/auth-helpers.ts` | Create | `requireRole()`, `requireAuth()`, `ForbiddenError` |
| `src/lib/auth-helpers.test.ts` | Create | Unit tests for role checking |
| `src/lib/actor.ts` | Modify | Replace Vercel JWT with NextAuth session |
| `src/lib/actor.test.ts` | Modify | Update tests for new getActor |
| `src/lib/actor-vercel-jwt.ts` | Delete | No longer needed |
| `src/app/api/auth/[...nextauth]/route.ts` | Create | NextAuth route handler |
| `src/app/api/users/route.ts` | Create | GET list users (admin) |
| `src/app/api/users/[id]/route.ts` | Create | PUT update user role (admin) |
| `src/middleware.ts` | Create | Route protection via NextAuth |
| `src/app/layout.tsx` | Modify | Wrap in SessionProvider |
| `src/components/layout/app-shell.tsx` | Modify | Pass session to sidebar |
| `src/components/layout/sidebar.tsx` | Modify | Add user section, admin nav, role-based hiding |
| `src/app/settings/users/page.tsx` | Create | Admin user management page |
| `src/app/api/obligations/route.ts` | Modify | Add requireRole checks |
| `src/app/api/obligations/[id]/route.ts` | Modify | Add requireRole checks |
| `src/app/api/obligations/[id]/complete/route.ts` | Modify | Add requireRole checks |
| `src/app/api/obligations/bulk/route.ts` | Modify | Add requireRole checks |
| `src/app/api/templates/route.ts` | Modify | Add requireRole checks |
| `src/app/api/audit/route.ts` | Modify | Add requireRole check (viewer) |
| `src/app/api/stats/route.ts` | Modify | Add requireRole check (viewer) |
| `src/app/api/analytics/route.ts` | Modify | Add requireRole check (viewer) |
| `package.json` | Modify | Add `next-auth@5`, remove `jose` |

---

## Task 1: Install NextAuth.js and add `users` table

**Files:**
- Modify: `package.json`
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Install next-auth**

Run: `npm install next-auth@5 @auth/core`
Expected: Adds `next-auth` and `@auth/core` to dependencies.

- [ ] **Step 2: Add the `users` table to schema.ts**

Append to `src/db/schema.ts` after the `auditLog` table:

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  role: text('role').notNull().default('viewer'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
```

- [ ] **Step 3: Add `CREATE TABLE users` to in-memory init**

In `src/db/index.ts`, inside the `initInMemory()` function, after the `audit_log` index creation, add:

```ts
await client.execute(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`)
```

- [ ] **Step 4: Create the table on Turso**

Run:
```bash
turso db shell compliance-tracker "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, image TEXT, role TEXT NOT NULL DEFAULT 'viewer', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);"
```

Verify: `turso db shell compliance-tracker "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"`
Expected: `users`

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

Stage `package.json`, `package-lock.json`, `src/db/schema.ts`, `src/db/index.ts`. Commit with message `feat(auth): add users table and install next-auth`.

---

## Task 2: NextAuth.js config with Google provider

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create the NextAuth config**

Create `src/lib/auth.ts`:

```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/api/auth/signin',
    error: '/api/auth/error',
  },
  callbacks: {
    async signIn({ user }) {
      const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN
      if (!allowedDomain) return true // No domain restriction if not configured

      const email = user.email
      if (!email) return false
      if (!email.endsWith(`@${allowedDomain}`)) {
        return false
      }
      return true
    },

    async jwt({ token, user, trigger }) {
      // On initial sign-in, find or create the user in the DB
      if (user?.email) {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))

        if (existing.length > 0) {
          token.userId = existing[0].id
          token.role = existing[0].role
        } else {
          // Check if this is the very first user (auto-admin)
          const allUsers = await db.select().from(users)
          const isFirstUser = allUsers.length === 0
          const now = new Date().toISOString()
          const newId = ulid()

          await db.insert(users).values({
            id: newId,
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            role: isFirstUser ? 'admin' : 'viewer',
            createdAt: now,
            updatedAt: now,
          })

          token.userId = newId
          token.role = isFirstUser ? 'admin' : 'viewer'
        }
      }

      // On session update, re-read role from DB
      if (trigger === 'update' && token.email) {
        const current = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email as string))
        if (current.length > 0) {
          token.role = current[0].role
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
})
```

- [ ] **Step 2: Add type augmentation for the session**

Add to the top of `src/lib/auth.ts`, before the imports:

```ts
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    role?: string
  }
}
```

- [ ] **Step 3: Create the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: Build succeeds. `/api/auth/[...nextauth]` appears in the route table.

- [ ] **Step 5: Commit**

Stage `src/lib/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`. Commit with message `feat(auth): add NextAuth config with Google provider`.

---

## Task 3: `requireRole` and `requireAuth` helpers

**Files:**
- Create: `src/lib/auth-helpers.ts`
- Create: `src/lib/auth-helpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/auth-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkRole, ForbiddenError } from './auth-helpers'

describe('checkRole', () => {
  it('allows admin for any role requirement', () => {
    expect(() => checkRole('admin', 'viewer')).not.toThrow()
    expect(() => checkRole('admin', 'editor')).not.toThrow()
    expect(() => checkRole('admin', 'admin')).not.toThrow()
  })

  it('allows editor for viewer and editor requirements', () => {
    expect(() => checkRole('editor', 'viewer')).not.toThrow()
    expect(() => checkRole('editor', 'editor')).not.toThrow()
  })

  it('rejects editor for admin requirement', () => {
    expect(() => checkRole('editor', 'admin')).toThrow(ForbiddenError)
  })

  it('allows viewer only for viewer requirement', () => {
    expect(() => checkRole('viewer', 'viewer')).not.toThrow()
  })

  it('rejects viewer for editor requirement', () => {
    expect(() => checkRole('viewer', 'editor')).toThrow(ForbiddenError)
  })

  it('rejects viewer for admin requirement', () => {
    expect(() => checkRole('viewer', 'admin')).toThrow(ForbiddenError)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest src/lib/auth-helpers.test.ts --run`
Expected: FAIL (cannot import auth-helpers).

- [ ] **Step 3: Implement the helpers**

Create `src/lib/auth-helpers.ts`:

```ts
import { auth } from './auth'
import { NextResponse } from 'next/server'

export type Role = 'viewer' | 'editor' | 'admin'

const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export function checkRole(userRole: string, minRole: Role): void {
  const level = ROLE_HIERARCHY[userRole as Role]
  const required = ROLE_HIERARCHY[minRole]
  if (level === undefined || level < required) {
    throw new ForbiddenError()
  }
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.email) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireRole(minRole: Role) {
  const { session, error } = await requireAuth()
  if (error) return { session: null, error }

  try {
    checkRole(session!.user.role, minRole)
    return { session: session!, error: null }
  } catch {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest src/lib/auth-helpers.test.ts --run`
Expected: 6 passing.

- [ ] **Step 5: Commit**

Stage `src/lib/auth-helpers.ts` and `src/lib/auth-helpers.test.ts`. Commit with message `feat(auth): add requireRole and requireAuth helpers`.

---

## Task 4: Next.js middleware for route protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the middleware**

Create `src/middleware.ts`:

```ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
  const isCronRoute = req.nextUrl.pathname.startsWith('/api/cron')
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  // Allow auth and cron routes through
  if (isAuthRoute || isCronRoute) return NextResponse.next()

  // No session = not authenticated
  if (!req.auth) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Redirect to sign-in for page requests
    const signInUrl = new URL('/api/auth/signin', req.nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.href)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

Stage `src/middleware.ts`. Commit with message `feat(auth): add route protection middleware`.

---

## Task 5: Migrate `getActor()` from Vercel JWT to NextAuth

**Files:**
- Modify: `src/lib/actor.ts`
- Delete: `src/lib/actor-vercel-jwt.ts`
- Modify: `src/lib/actor.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Rewrite getActor**

Replace the contents of `src/lib/actor.ts` with:

```ts
import { auth } from './auth'

export type Actor = {
  email: string
  source: 'sso' | 'cron' | 'dev' | 'system'
}

export async function getActor(req?: Request): Promise<Actor> {
  // 1. NextAuth session (primary)
  const session = await auth()
  if (session?.user?.email) {
    return { email: session.user.email, source: 'sso' }
  }

  // 2. Cron secret (for /api/cron/* routes)
  if (req) {
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return { email: 'cron', source: 'cron' }
    }
  }

  // 3. Dev fallback
  if (process.env.NODE_ENV !== 'production') {
    return { email: process.env.DEV_ACTOR ?? 'dev@local', source: 'dev' }
  }

  // 4. System fallback
  return { email: 'system', source: 'system' }
}
```

- [ ] **Step 2: Delete the Vercel JWT verifier**

Delete the file `src/lib/actor-vercel-jwt.ts`.

- [ ] **Step 3: Update actor tests**

Replace the contents of `src/lib/actor.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the auth module before importing getActor
vi.mock('./auth', () => ({
  auth: vi.fn(),
}))

import { getActor } from './actor'
import { auth } from './auth'

const mkReq = (opts: { auth?: string } = {}) => {
  const headers = new Headers()
  if (opts.auth) headers.set('authorization', opts.auth)
  return new Request('http://localhost/api/test', { headers })
}

describe('getActor', () => {
  const origEnv = { ...process.env }
  beforeEach(() => {
    process.env = { ...origEnv }
    vi.mocked(auth).mockResolvedValue(null as any)
  })
  afterEach(() => {
    process.env = origEnv
  })

  it('returns sso actor when NextAuth session exists', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: '1', email: 'alice@acme.com', role: 'admin' },
      expires: '',
    } as any)
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'alice@acme.com', source: 'sso' })
  })

  it('returns cron actor when Authorization header matches CRON_SECRET', async () => {
    process.env.CRON_SECRET = 'shh'
    const actor = await getActor(mkReq({ auth: 'Bearer shh' }))
    expect(actor).toEqual({ email: 'cron', source: 'cron' })
  })

  it('does not match cron on wrong secret', async () => {
    process.env.CRON_SECRET = 'shh'
    process.env.NODE_ENV = 'production'
    const actor = await getActor(mkReq({ auth: 'Bearer wrong' }))
    expect(actor).toEqual({ email: 'system', source: 'system' })
  })

  it('returns dev actor in non-production when no session', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_ACTOR = 'dev@local'
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'dev@local', source: 'dev' })
  })

  it('returns system when nothing is present in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.CRON_SECRET
    const actor = await getActor(mkReq())
    expect(actor).toEqual({ email: 'system', source: 'system' })
  })
})
```

- [ ] **Step 4: Remove jose dependency**

Run: `npm uninstall jose`

- [ ] **Step 5: Run tests**

Run: `npx vitest src/lib/actor.test.ts --run`
Expected: 5 passing.

- [ ] **Step 6: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

Stage `src/lib/actor.ts`, `src/lib/actor.test.ts`, `package.json`, `package-lock.json`. Remove `src/lib/actor-vercel-jwt.ts` from git: `git rm src/lib/actor-vercel-jwt.ts`. Commit with message `feat(auth): migrate getActor from Vercel JWT to NextAuth session`.

---

## Task 6: Add `requireRole` checks to all API routes

**Files:**
- Modify: `src/app/api/obligations/route.ts`
- Modify: `src/app/api/obligations/[id]/route.ts`
- Modify: `src/app/api/obligations/[id]/complete/route.ts`
- Modify: `src/app/api/obligations/bulk/route.ts`
- Modify: `src/app/api/templates/route.ts`
- Modify: `src/app/api/audit/route.ts`
- Modify: `src/app/api/stats/route.ts`
- Modify: `src/app/api/analytics/route.ts`

Each route handler needs a role check at the top. The pattern for every route:

```ts
import { requireRole } from '@/lib/auth-helpers'
```

- [ ] **Step 1: GET routes — require viewer**

For each GET handler in these files, add at the top of the `try` block:

```ts
const { session, error } = await requireRole('viewer')
if (error) return error
```

Apply to:
- `src/app/api/obligations/route.ts` (GET handler)
- `src/app/api/obligations/[id]/route.ts` (GET handler)
- `src/app/api/audit/route.ts` (GET handler)
- `src/app/api/stats/route.ts` (GET handler)
- `src/app/api/analytics/route.ts` (GET handler)
- `src/app/api/templates/route.ts` (GET handler)

- [ ] **Step 2: Mutation routes — require editor**

For each POST/PUT/DELETE handler, add at the top of the `try` block:

```ts
const { session, error } = await requireRole('editor')
if (error) return error
```

Apply to:
- `src/app/api/obligations/route.ts` (POST and DELETE handlers)
- `src/app/api/obligations/[id]/route.ts` (PUT and DELETE handlers)
- `src/app/api/obligations/[id]/complete/route.ts` (POST handler)
- `src/app/api/obligations/bulk/route.ts` (POST handler)
- `src/app/api/templates/route.ts` (POST handler — the template apply route)

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

Stage all modified route files. Commit with message `feat(auth): add requireRole checks to all API routes`.

---

## Task 7: Users API routes (admin only)

**Files:**
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[id]/route.ts`

- [ ] **Step 1: Create GET /api/users**

Create `src/app/api/users/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { users } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))

    return NextResponse.json({ users: allUsers })
  } catch (err) {
    console.error('Users list error:', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create PUT /api/users/[id]**

Create `src/app/api/users/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'
import { getActor } from '@/lib/actor'
import { logEvent } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['viewer', 'editor', 'admin'] as const

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { error } = await requireRole('admin')
  if (error) return error

  try {
    await dbReady
    const body = await req.json()
    const newRole = body.role

    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 },
      )
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, params.id))

    if (existing.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = existing[0]
    const oldRole = user.role

    if (oldRole === newRole) {
      return NextResponse.json({ success: true, message: 'Role unchanged' })
    }

    // Prevent demoting the last admin
    if (oldRole === 'admin' && newRole !== 'admin') {
      const adminCount = (
        await db.select().from(users).where(eq(users.role, 'admin'))
      ).length
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last admin' },
          { status: 400 },
        )
      }
    }

    await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date().toISOString() })
      .where(eq(users.id, params.id))

    const actor = await getActor(req)
    await logEvent({
      type: 'user.role_changed' as any,
      actor,
      entityType: 'obligation' as any, // reuse entity type for now
      entityId: params.id,
      summary: `Changed ${user.email} role from ${oldRole} to ${newRole}`,
      diff: { role: [oldRole, newRole] },
      metadata: { userId: params.id, email: user.email },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Update user role error:', err)
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/api/users` and `/api/users/[id]` appear in the route table.

- [ ] **Step 4: Commit**

Stage both route files. Commit with message `feat(auth): add admin-only users API routes`.

---

## Task 8: SessionProvider and sidebar user section

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Wrap layout in SessionProvider**

In `src/app/layout.tsx`, add the SessionProvider import and wrap the body content:

```tsx
import { SessionProvider } from 'next-auth/react'
```

Wrap the `<body>` children:

```tsx
<body className={`${plusJakarta.variable} ${jetbrainsMono.variable} dark`}>
  <SessionProvider>
    <AppShell>{children}</AppShell>
    <Toaster position="bottom-right" theme="dark" />
  </SessionProvider>
</body>
```

- [ ] **Step 2: Update the sidebar with user section and role-based nav**

Replace the contents of `src/components/layout/sidebar.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { LayoutDashboard, Calendar, FileText, Tag, Shield, Sparkles, TrendingUp, History, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard', label: 'Dashboard', icon: TrendingUp },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/obligations', label: 'Obligations', icon: FileText },
  { href: '/templates', label: 'Templates', icon: Sparkles },
  { href: '/activity', label: 'Activity', icon: History },
  { href: '/categories', label: 'Categories', icon: Tag },
]

const roleBadgeColors: Record<string, string> = {
  admin: 'text-red-400 bg-red-950/50 border-red-800/50',
  editor: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
  viewer: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role ?? 'viewer'

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#050b18] border-r border-[#1e2d47] flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1e2d47]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">Acme Corp</div>
            <div className="text-[10px] text-amber-500/80 font-mono uppercase tracking-widest">Compliance</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors',
                active
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1629]',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
        {role === 'admin' && (
          <Link
            href="/settings/users"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1629]',
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
        )}
      </nav>

      {/* User section */}
      <div className="px-4 py-3 border-t border-[#1e2d47]">
        {session?.user ? (
          <div className="flex items-center gap-2.5">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full border border-[#1e2d47]" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1e2d47] flex items-center justify-center text-xs text-slate-400 font-mono">
                {session.user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 truncate">{session.user.name ?? session.user.email}</div>
              <span className={cn('inline-flex px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded', roleBadgeColors[role] ?? roleBadgeColors.viewer)}>
                {role.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-600 font-mono">Not signed in</div>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

Stage `src/app/layout.tsx` and `src/components/layout/sidebar.tsx`. Commit with message `feat(auth): add SessionProvider and user section to sidebar`.

---

## Task 9: Admin settings page

**Files:**
- Create: `src/app/settings/users/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/settings/users/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type User = {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
  createdAt: string
}

const ROLES = ['viewer', 'editor', 'admin'] as const

const roleBadgeColors: Record<string, string> = {
  admin: 'text-red-400 bg-red-950/50 border-red-800/50',
  editor: 'text-amber-400 bg-amber-950/50 border-amber-800/50',
  viewer: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
}

export default function UsersSettingsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.role !== 'admin') {
      router.push('/')
      return
    }
    fetch('/api/users')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then(d => setUsers(d.users))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [session, router])

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)),
      )
      toast.success('Role updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  if (session?.user?.role !== 'admin') return null

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">User Management</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Manage roles and access</p>
        </div>
        <div className="text-xs font-mono text-slate-500">{users.length} users</div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 font-mono">Loading...</div>
      ) : (
        <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47] text-slate-500">
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-right px-3 py-2 font-medium font-mono">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={`border-b border-[#1e2d47]/50 ${i % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {user.image ? (
                        <img src={user.image} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#1e2d47] flex items-center justify-center text-[10px] text-slate-400 font-mono">
                          {user.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-slate-300">{user.name ?? 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-400">{user.email}</td>
                  <td className="px-3 py-2">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className="bg-[#0a0e1a] border border-[#1e2d47] text-slate-300 text-xs px-2 py-1 rounded focus:border-amber-500/50 focus:outline-none"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds and `/settings/users` appears in the route table.

- [ ] **Step 3: Commit**

Stage `src/app/settings/users/page.tsx`. Commit with message `feat(auth): add admin user management page`.

---

## Task 10: Hide editor-only UI for viewers

**Files:**
- Modify: `src/app/obligations/page.tsx`

- [ ] **Step 1: Add role-aware conditional rendering**

In `src/app/obligations/page.tsx`, the main `ObligationsPage` component (the `'use client'` component):

Add the session hook at the top:

```tsx
import { useSession } from 'next-auth/react'
```

Inside the component:

```tsx
const { data: session } = useSession()
const canEdit = session?.user?.role === 'editor' || session?.user?.role === 'admin'
```

Then wrap editor-only UI elements in `{canEdit && (...)}`:
- The "Add Obligation" button
- The "Mark Complete" section in DetailPanel
- The delete button/functionality
- Bulk action controls

Pass `canEdit` as a prop to `DetailPanel`:

```tsx
<DetailPanel item={selectedItem} onClose={...} onComplete={...} canEdit={canEdit} />
```

In the `DetailPanel` function signature, add `canEdit: boolean` to the props. Wrap the "Mark complete" section and any edit/delete controls in `{canEdit && (...)}`.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

Stage `src/app/obligations/page.tsx`. Commit with message `feat(auth): hide editor-only UI for viewers`.

---

## Task 11: Set env vars and deploy

- [ ] **Step 1: Generate NEXTAUTH_SECRET**

Run: `openssl rand -base64 32`
Copy the output.

- [ ] **Step 2: Set Vercel env vars**

The user needs to create a Google Cloud OAuth 2.0 app first (manual step). Once they have the client ID and secret:

```bash
printf '<generated-secret>' | vercel env add NEXTAUTH_SECRET production
printf 'https://compliance-tracker-alturki.vercel.app' | vercel env add NEXTAUTH_URL production
printf '<google-client-id>' | vercel env add GOOGLE_CLIENT_ID production
printf '<google-client-secret>' | vercel env add GOOGLE_CLIENT_SECRET production
printf '<company-domain>' | vercel env add GOOGLE_ALLOWED_DOMAIN production
```

Use `printf` (not `echo`) to avoid trailing newlines.

- [ ] **Step 3: Push and deploy**

```bash
git push
vercel --prod --force --yes
```

- [ ] **Step 4: Verify**

- Open the production URL in a browser.
- Should redirect to Google sign-in.
- Sign in with a company Google account.
- First user should get admin role.
- Check sidebar shows user avatar, name, and "ADMIN" badge.
- Navigate to Settings → User Management.
- Verify obligations page shows edit controls.

- [ ] **Step 5: Disable Vercel Deployment Protection**

In the Vercel dashboard: Settings → Deployment Protection → set to "Standard Protection" (only preview deployments protected, production is open).

- [ ] **Step 6: Commit any follow-up fixes**

If any issues arise, fix and commit with message `fix(auth): follow-up fixes from live verification`.

---

## Self-review

**Spec coverage:**
- Auth flow (Google OAuth via NextAuth) → Task 2 ✓
- Data model (users table) → Task 1 ✓
- Middleware (route protection) → Task 4 ✓
- Permission enforcement (requireRole) → Tasks 3, 6 ✓
- UI enforcement (role-based hiding) → Tasks 8, 10 ✓
- Admin settings page → Task 9 ✓
- getActor migration → Task 5 ✓
- Users API → Task 7 ✓
- Env vars and deploy → Task 11 ✓
- Remove Vercel SSO → Tasks 5 (code), 11 (Vercel settings) ✓
- Audit event for role change → Task 7 (in PUT handler) ✓

**Placeholder scan:** No TBD/TODO. Every code step has complete code. Every test step has complete test code. File paths are exact.

**Type consistency:**
- `Role` type = `'viewer' | 'editor' | 'admin'` — consistent across auth-helpers.ts, users API, sidebar, settings page ✓
- `Actor` type unchanged — same `{ email, source }` shape ✓
- `Session.user` augmented with `id` and `role` — used consistently in middleware, sidebar, settings page ✓
- `checkRole` / `requireRole` — checkRole is the pure function (tested), requireRole is the async wrapper (used in routes) ✓
