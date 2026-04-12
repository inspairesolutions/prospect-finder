import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// DELETE — remove a placeId from the discard list (undo)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await params

    await prisma.discardedPlace.deleteMany({ where: { placeId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Undiscard error:', error)
    return NextResponse.json({ error: 'Failed to undiscard' }, { status: 500 })
  }
}
