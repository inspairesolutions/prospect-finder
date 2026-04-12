import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// PATCH /api/prospects/[id]/threads/[threadId]/messages/[msgId] — mark as read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string; msgId: string }> }
) {
  try {
    const { msgId } = await params

    const message = await prisma.emailMessage.update({
      where: { id: msgId },
      data: { readAt: new Date() },
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Mark read error:', error)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
}
