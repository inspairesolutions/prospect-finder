import { NextResponse } from 'next/server'
import dns from 'node:dns/promises'
import { requireAdmin } from '@/lib/auth-helpers'
import { verifySmtpConnection } from '@/lib/email'

export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error

  const hostname = process.env.SMTP_HOST ?? null
  const hostUsed = process.env.SMTP_HOST_IP || process.env.SMTP_HOST || null
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = port === 465 || process.env.SMTP_SECURE === 'true'

  let dnsLookup: Array<{ address: string; family: number }> = []
  if (hostname) {
    try {
      dnsLookup = await dns.lookup(hostname, { all: true, verbatim: true })
    } catch {
      dnsLookup = []
    }
  }

  try {
    await verifySmtpConnection()

    return NextResponse.json({
      ok: true,
      message: 'Conexion SMTP satisfactoria',
      details: {
        hostname,
        hostUsed,
        port,
        secure,
        dnsLookup,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No fue posible conectar al servidor SMTP'
    const networkError = err as {
      code?: string
      errno?: string | number
      syscall?: string
      address?: string
      port?: number
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        details: {
          hostname,
          hostUsed,
          port,
          secure,
          dnsLookup,
          code: networkError?.code ?? null,
          errno: networkError?.errno ?? null,
          syscall: networkError?.syscall ?? null,
          address: networkError?.address ?? null,
          errorPort: networkError?.port ?? null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
