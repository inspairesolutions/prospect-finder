import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { isInstallAllowed } from '@/lib/install-allowed'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  if (req.nextUrl.pathname === '/install' && !isInstallAllowed()) {
    return new NextResponse(null, { status: 404 })
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
