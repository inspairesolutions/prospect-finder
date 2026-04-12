import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { checkReplies } from '@/lib/email'

// POST /api/prospects/[id]/threads/check — poll IMAP for new replies
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Collect all outbound messageIds for threads of this prospect
    const messages = await prisma.emailMessage.findMany({
      where: {
        direction: 'outbound',
        thread: { prospectId: id },
        messageId: { not: null },
      },
      select: {
        messageId: true,
        threadId: true,
      },
    })

    if (messages.length === 0) {
      return NextResponse.json({ newMessages: 0 })
    }

    const messageIdToThread = new Map<string, string>()
    const knownMessageIds: string[] = []

    for (const m of messages) {
      if (m.messageId) {
        knownMessageIds.push(m.messageId)
        messageIdToThread.set(m.messageId, m.threadId)
      }
    }

    // Fetch already-saved inbound messageIds to avoid duplicates
    const existingInbound = await prisma.emailMessage.findMany({
      where: {
        direction: 'inbound',
        thread: { prospectId: id },
      },
      select: { messageId: true },
    })

    const existingIds = new Set(existingInbound.map((m) => m.messageId).filter(Boolean))

    const replies = await checkReplies(knownMessageIds)

    let newCount = 0

    for (const reply of replies) {
      // Skip if already saved
      if (reply.messageId && existingIds.has(reply.messageId)) continue

      const threadId = messageIdToThread.get(reply.inReplyTo)
      if (!threadId) continue

      await prisma.emailMessage.create({
        data: {
          threadId,
          direction: 'inbound',
          fromEmail: reply.fromEmail,
          fromName: reply.fromName || null,
          toEmail: process.env.SMTP_USER!,
          subject: reply.subject,
          bodyHtml: reply.bodyHtml,
          bodyText: reply.bodyText || null,
          messageId: reply.messageId || null,
          inReplyTo: reply.inReplyTo,
          // readAt left null → unread
        },
      })

      // Update thread's updatedAt
      await prisma.emailThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() },
      })

      newCount++
    }

    return NextResponse.json({ newMessages: newCount })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('IMAP check error:', msg, error)
    return NextResponse.json({ error: `Error al sincronizar: ${msg}` }, { status: 500 })
  }
}
