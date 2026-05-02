import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { isLikelyScannerEmailOpen } from '@/lib/email-tracking'

export const runtime = 'nodejs'

const PIXEL_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (!forwardedFor) return null
  return forwardedFor.split(',')[0]?.trim() || null
}

function pixelResponse(): NextResponse {
  const buffer = Buffer.from(PIXEL_GIF_BASE64, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token) {
    return pixelResponse()
  }

  try {
    const message = await prisma.emailMessage.findUnique({
      where: { openTrackingToken: token },
      select: { id: true, direction: true, firstOpenUserAgent: true, firstOpenIp: true },
    })

    if (!message || message.direction !== 'outbound') {
      return pixelResponse()
    }

    const now = new Date()
    const userAgent = request.headers.get('user-agent')
    const ua = userAgent ?? ''
    const ip = getClientIp(request)
    const likelyScanner = isLikelyScannerEmailOpen(ua)

    await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        openCount: { increment: 1 },
        openedAt: now,
        ...(message.firstOpenUserAgent ? {} : { firstOpenUserAgent: userAgent ?? undefined }),
        ...(message.firstOpenIp ? {} : { firstOpenIp: ip ?? undefined }),
        ...(likelyScanner
          ? {}
          : {
              humanOpenCount: { increment: 1 },
              openedHumanAt: now,
            }),
      },
    })
  } catch (error) {
    console.error('Open tracking error:', error)
  }

  return pixelResponse()
}
