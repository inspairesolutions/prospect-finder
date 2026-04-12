import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET — list all discarded placeIds
export async function GET() {
  try {
    const records = await prisma.discardedPlace.findMany({
      select: { placeId: true },
    })
    return NextResponse.json(records.map((r) => r.placeId))
  } catch (error) {
    console.error('Get discarded error:', error)
    return NextResponse.json({ error: 'Failed to fetch discarded' }, { status: 500 })
  }
}

// POST — add a placeId to the discard list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { placeId } = body

    if (!placeId) {
      return NextResponse.json({ error: 'placeId es requerido' }, { status: 400 })
    }

    await prisma.discardedPlace.upsert({
      where: { placeId },
      update: {},
      create: { placeId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Discard error:', error)
    return NextResponse.json({ error: 'Failed to discard' }, { status: 500 })
  }
}
