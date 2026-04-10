import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ulid } from 'ulid'

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

declare module '@auth/core/jwt' {
  interface JWT {
    userId?: string
    role?: string
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN
      if (!allowedDomain) return true
      const email = user.email
      if (!email) return false
      if (!email.endsWith(`@${allowedDomain}`)) return false
      return true
    },

    async jwt({ token, user }) {
      if (user?.email) {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))

        if (existing.length > 0) {
          token.userId = existing[0].id
          token.role = existing[0].role
        } else {
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
    maxAge: 24 * 60 * 60,
  },
})
