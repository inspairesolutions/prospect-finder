import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const toEmail = typeof body?.toEmail === 'string' ? body.toEmail.trim() : ''
    const subject = typeof body?.subject === 'string' && body.subject.trim()
      ? body.subject.trim()
      : 'Prueba SMTP - Prospect Finder'

    if (!toEmail) {
      return NextResponse.json({ error: 'El email de destino es requerido' }, { status: 400 })
    }

    await sendEmail({
      to: toEmail,
      subject,
      bodyHtml:
        '<p>Este es un correo de prueba enviado desde <strong>Prospect Finder</strong>.</p><p>Si recibes este mensaje, la configuracion SMTP funciona correctamente.</p>',
    })

    return NextResponse.json({
      ok: true,
      message: `Correo de prueba enviado a ${toEmail}`,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No fue posible enviar el correo de prueba'
    return NextResponse.json({ ok: false, error: message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
