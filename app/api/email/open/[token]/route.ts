import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

const PIXEL_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const BOT_USER_AGENT_PATTERNS = [
  /googleimageproxy/i,
  /google-inspectiontool/i,
  /microsoft office/i,
  /microsoft preview/i,
  /outlook-ios/i,
  /thunderbird/i,
  /yahoo! slurp/i,
  /barracuda/i,
  /proofpoint/i,
  /mimecast/i,
  /symantec/i,
  /virus/i,
  /scanner/i,
  /crawler/i,
  /spider/i,
  /bot/i,
]

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (!forwardedFor) return null
  return forwardedFor.split(',')[0]?.trim() || null
}

function isLikelyBotOpen(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') ?? ''
  const hasBotUserAgent = BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent))
  if (hasBotUserAgent) return true

  // Scanners suelen no enviar cabeceras de navegación típicas.
  const acceptLanguage = request.headers.get('accept-language')
  const secFetchDest = request.headers.get('sec-fetch-dest')
  const hasLikelyScannerHeaders = !acceptLanguage && !secFetchDest
  return hasLikelyScannerHeaders
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
    const ip = getClientIp(request)
    const likelyBot = isLikelyBotOpen(request)

    await prisma.emailMessage.update({
      where: { id: message.id },
      data: {
        openCount: { increment: 1 },
        openedAt: now,
        ...(message.firstOpenUserAgent ? {} : { firstOpenUserAgent: userAgent ?? undefined }),
        ...(message.firstOpenIp ? {} : { firstOpenIp: ip ?? undefined }),
        ...(likelyBot
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
