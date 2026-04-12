import type { NextAuthConfig } from 'next-auth'

/**
 * Auth config that can run on Edge Runtime (no Node.js dependencies).
 * Used by middleware for JWT verification only.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [], // Providers added in lib/auth.ts (Node runtime only)
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl

      // Always allow auth API routes
      if (pathname.startsWith('/api/auth')) return true

      // Login page: redirect authenticated users to dashboard
      if (pathname === '/login') {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', request.nextUrl))
        }
        return true
      }

      // First-time install (no auth required)
      if (pathname === '/install') {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', request.nextUrl))
        }
        return true
      }

      // Protect admin routes
      if (pathname.startsWith('/admin') && auth?.user?.role !== 'ADMIN') {
        return Response.redirect(new URL('/dashboard', request.nextUrl))
      }

      // All other routes require authentication
      return isLoggedIn
    },
  },
}
