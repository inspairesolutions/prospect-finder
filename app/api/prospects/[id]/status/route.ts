import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ProspectStatus } from '@prisma/client'

const REQUIRED_FIELDS_FOR_READY = [
  'description',
  'services',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, notes, changedBy } = body

    if (!status || !Object.values(ProspectStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get current prospect
    const currentProspect = await prisma.prospect.findUnique({
      where: { id },
    })

    if (!currentProspect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }

    // Validate required fields for READY status
    if (status === 'READY') {
      const missingFields = REQUIRED_FIELDS_FOR_READY.filter(
        (field) => !currentProspect[field as keyof typeof currentProspect]
      )

      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: 'Missing required fields for Ready status',
            missingFields,
          },
          { status: 400 }
        )
      }
    }

    // Update prospect and create status history entry
    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        status,
        statusHistory: {
          create: {
            fromStatus: currentProspect.status,
            toStatus: status,
            notes,
            changedBy,
          },
        },
      },
      include: {
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Auto-discard when status is set to ARCHIVED
    if (status === 'ARCHIVED' && currentProspect.placeId) {
      await prisma.discardedPlace.upsert({
        where: { placeId: currentProspect.placeId },
        update: {},
        create: { placeId: currentProspect.placeId },
      })
    }

    return NextResponse.json(prospect)
  } catch (error) {
    console.error('Update status error:', error)
    return NextResponse.json(
      { error: 'Failed to update status' },
      { status: 500 }
    )
  }
}
