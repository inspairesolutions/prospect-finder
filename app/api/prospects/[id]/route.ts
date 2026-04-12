import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        photos: true,
        reviews: {
          orderBy: { time: 'desc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(prospect)
  } catch (error) {
    console.error('Get prospect error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prospect' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Only allow updating editable fields
    const allowedFields = [
      'notes',
      'logoUrl',
      'facebookUrl',
      'instagramUrl',
      'linkedinUrl',
      'twitterUrl',
      'description',
      'services',
      'uniqueSellingPoints',
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'preferredWebStyle',
      'proposedWebUrl',
      'contactEmail',
      'priority',
      'assignedTo',
      'lastContactedAt',
      'nextFollowUpAt',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    // Handle date fields
    if (updateData.lastContactedAt && typeof updateData.lastContactedAt === 'string') {
      updateData.lastContactedAt = new Date(updateData.lastContactedAt)
    }
    if (updateData.nextFollowUpAt && typeof updateData.nextFollowUpAt === 'string') {
      updateData.nextFollowUpAt = new Date(updateData.nextFollowUpAt)
    }

    const prospect = await prisma.prospect.update({
      where: { id },
      data: updateData,
      include: {
        photos: true,
        reviews: true,
        files: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(prospect)
  } catch (error) {
    console.error('Update prospect error:', error)
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update prospect' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.prospect.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete prospect error:', error)
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to delete prospect' },
      { status: 500 }
    )
  }
}
