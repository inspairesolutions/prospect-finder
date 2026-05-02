import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isLikelyScannerEmailClick } from '@/lib/email-tracking'

export const runtime = 'nodejs'

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (!forwardedFor) return null
  return forwardedFor.split(',')[0]?.trim() || null
}

function redirectFallback(request: NextRequest): NextResponse {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.EMAIL_TRACKING_BASE_URL?.trim()
  if (configured) {
    const base = configured.replace(/\/$/, '')
    return NextResponse.redirect(`${base}/`, 302)
  }
  return NextResponse.redirect(new URL('/', request.url), 302)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) {
    return redirectFallback(request)
  }

  try {
    const message = await prisma.emailMessage.findUnique({
      where: { clickTrackingToken: token },
      select: {
        id: true,
        direction: true,
        proposedUrl: true,
        firstClickedAt: true,
        firstClickedHumanAt: true,
      },
    })

    if (!message || message.direction !== 'outbound' || !message.proposedUrl?.trim()) {
      return redirectFallback(request)
    }

    const destination = message.proposedUrl.trim()
    const now = new Date()
    const userAgent = request.headers.get('user-agent')
    const ua = userAgent ?? ''
    const ip = getClientIp(request)
    const likelyScanner = isLikelyScannerEmailClick(ua)

    await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        clickCount: { increment: 1 },
        ...(message.firstClickedAt
          ? {}
          : {
              firstClickedAt: now,
              firstClickIp: ip ?? undefined,
              firstClickUserAgent: userAgent ?? undefined,
            }),
        ...(likelyScanner
          ? {}
          : {
              humanClickCount: { increment: 1 },
              ...(message.firstClickedHumanAt ? {} : { firstClickedHumanAt: now }),
            }),
      },
    })

    return NextResponse.redirect(destination, 302)
  } catch (error) {
    console.error('Click tracking error:', error)
    return redirectFallback(request)
  }
}
