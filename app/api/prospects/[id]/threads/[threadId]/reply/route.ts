import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// POST /api/prospects/[id]/threads/[threadId]/reply — send reply in thread
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    const { id, threadId } = await params
    const body = await request.json()
    const { bodyHtml } = body

    if (!bodyHtml) {
      return NextResponse.json({ error: 'bodyHtml es requerido' }, { status: 400 })
    }

    const thread = await prisma.emailThread.findFirst({
      where: { id: threadId, prospectId: id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const lastMessage = thread.messages[0]
    const inReplyTo = lastMessage?.messageId ?? undefined

    const fromEmail = process.env.SMTP_USER!
    const fromName = (process.env.SMTP_FROM ?? fromEmail)
      .replace(/<.*>/, '')
      .trim()

    const { messageId } = await sendEmail({
      to: thread.toEmail,
      toName: thread.toName ?? undefined,
      subject: `Re: ${thread.subject}`,
      bodyHtml,
      inReplyTo,
    })

    const message = await prisma.emailMessage.create({
      data: {
        threadId,
        direction: 'outbound',
        fromEmail,
        fromName,
        toEmail: thread.toEmail,
        subject: `Re: ${thread.subject}`,
        bodyHtml,
        messageId,
        inReplyTo: inReplyTo ?? null,
        readAt: new Date(),
      },
    })

    // Update thread's updatedAt
    await prisma.emailThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Reply error:', error)
    return NextResponse.json({ error: 'Error al enviar respuesta' }, { status: 500 })
  }
}
