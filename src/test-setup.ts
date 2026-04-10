import { vi } from 'vitest'

// Mock next-auth to prevent "Cannot find module 'next/server'" errors.
// next-auth imports next/server which only works inside Next.js runtime.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn().mockResolvedValue({
      user: { id: 'test-user', email: 'test@test.com', role: 'admin' },
      expires: '',
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn(() => ({})),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'test-user', email: 'test@test.com', role: 'admin' } },
    status: 'authenticated',
  })),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock @/lib/auth (our NextAuth config wrapper) so requireRole/requireAuth work.
// Returns an admin session so all role checks pass in tests by default.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'test-user', email: 'test@test.com', role: 'admin' },
    expires: '',
  }),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}))
