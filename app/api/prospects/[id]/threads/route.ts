import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// GET /api/prospects/[id]/threads — list threads with last message and unread count
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const threads = await prisma.emailThread.findMany({
      where: { prospectId: id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: { direction: 'inbound', readAt: null },
            },
          },
        },
      },
    })

    const result = threads.map((t) => ({
      id: t.id,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      subject: t.subject,
      toEmail: t.toEmail,
      toName: t.toName,
      status: t.status,
      lastMessage: t.messages[0] ?? null,
      unreadCount: t._count.messages,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get threads error:', error)
    return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 })
  }
}

// POST /api/prospects/[id]/threads — create thread + send first email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { toEmail, toName, subject, bodyHtml, proposalId } = body

    if (!toEmail || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: 'toEmail, subject y bodyHtml son requeridos' },
        { status: 400 }
      )
    }

    const prospect = await prisma.prospect.findUnique({ where: { id } })
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })
    }

    // Send via SMTP
    const { messageId } = await sendEmail({ to: toEmail, toName, subject, bodyHtml })

    const fromEmail = process.env.SMTP_USER!
    const fromName = (process.env.SMTP_FROM ?? fromEmail)
      .replace(/<.*>/, '')
      .trim()

    // Create thread + first message in a transaction
    const thread = await prisma.$transaction(async (tx) => {
      const t = await tx.emailThread.create({
        data: {
          prospectId: id,
          subject,
          toEmail,
          toName: toName ?? null,
        },
      })

      await tx.emailMessage.create({
        data: {
          threadId: t.id,
          direction: 'outbound',
          fromEmail,
          fromName,
          toEmail,
          subject,
          bodyHtml,
          messageId,
          readAt: new Date(), // outbound messages are always "read"
        },
      })

      // Link proposal to thread if provided
      if (proposalId) {
        await tx.emailProposal.update({
          where: { id: proposalId },
          data: { threadId: t.id, sentAt: new Date() },
        })
      }

      return t
    })

    return NextResponse.json(thread, { status: 201 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Create thread error:', msg, error)
    return NextResponse.json({ error: `Error al enviar email: ${msg}` }, { status: 500 })
  }
}
