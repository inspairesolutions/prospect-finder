import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth?.user

  // /install: la comprobación de ALLOW_INSTALL va en la página (Node) para leer .env de forma fiable

  // Always allow auth API routes
  if (pathname.startsWith('/api/auth')) return NextResponse.next()

  // Email open pixel & click redirects must work without session (recipient's mail client)
  if (
    pathname.startsWith('/api/email/open') ||
    pathname.startsWith('/api/email/click')
  ) {
    return NextResponse.next()
  }

  // Login & install pages: redirect authenticated users to dashboard
  if (pathname === '/login' || pathname === '/install') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // All other routes require authentication
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Protect admin routes
  if (pathname.startsWith('/admin') && req.auth?.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
