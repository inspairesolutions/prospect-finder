import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import googlePlaces from '@/lib/google-places'
import { ProspectStatus } from '@prisma/client'
import { auth } from '@/lib/auth'
import { triggerBackgroundAnalysis } from '@/lib/trigger-analysis'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Filters
    const status = searchParams.get('status') as ProspectStatus | null
    const statuses = searchParams.getAll('statuses') as ProspectStatus[]
    const hasWebsite = searchParams.get('hasWebsite')
    const hasPhone = searchParams.get('hasPhone')
    const minRating = searchParams.get('minRating')
    const maxRating = searchParams.get('maxRating')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const onlyMine = searchParams.get('onlyMine')

    // Build where clause
    const where: Record<string, unknown> = {}

    // Filter by assigned user (my prospects)
    if (onlyMine === 'true') {
      const session = await auth()
      if (session?.user?.id) {
        where.assignedTo = session.user.id
      }
    }

    if (status) {
      where.status = status
    } else if (statuses.length > 0) {
      where.status = { in: statuses }
    }

    if (hasWebsite === 'true') {
      where.website = { not: null }
    } else if (hasWebsite === 'false') {
      where.website = null
    }

    if (hasPhone === 'true') {
      where.phone = { not: null }
    } else if (hasPhone === 'false') {
      where.phone = null
    }

    if (minRating || maxRating) {
      where.googleRating = {}
      if (minRating) (where.googleRating as Record<string, number>).gte = parseFloat(minRating)
      if (maxRating) (where.googleRating as Record<string, number>).lte = parseFloat(maxRating)
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { formattedAddress: { contains: search } },
        { notes: { contains: search } },
      ]
    }

    // Get total count
    const total = await prisma.prospect.count({ where })

    // Get prospects with pagination
    const prospects = await prisma.prospect.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
      include: {
        photos: { take: 1 },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            reviews: true,
            files: true,
          },
        },
      },
    })

    return NextResponse.json({
      data: prospects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get prospects error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prospects' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { placeId } = body

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      )
    }

    // Check if prospect already exists
    const existing = await prisma.prospect.findUnique({
      where: { placeId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Prospect already exists', prospect: existing },
        { status: 409 }
      )
    }

    // Get current user to auto-assign
    const session = await auth()
    const currentUserId = session?.user?.id || null

    // Get place details from Google
    const placeDetails = await googlePlaces.getPlaceDetails(placeId)

    if (!placeDetails) {
      return NextResponse.json(
        { error: 'Place not found in Google Places' },
        { status: 404 }
      )
    }

    // Create prospect
    const prospect = await prisma.prospect.create({
      data: {
        placeId: placeDetails.place_id,
        name: placeDetails.name,
        formattedAddress: placeDetails.formatted_address,
        latitude: placeDetails.geometry.location.lat,
        longitude: placeDetails.geometry.location.lng,
        googleRating: placeDetails.rating,
        googleReviewCount: placeDetails.user_ratings_total,
        priceLevel: placeDetails.price_level,
        businessStatus: placeDetails.business_status,
        types: JSON.stringify(placeDetails.types || []),
        phone: placeDetails.formatted_phone_number || placeDetails.international_phone_number,
        website: placeDetails.website,
        googleMapsUrl: placeDetails.url,
        openingHours: placeDetails.opening_hours ? JSON.stringify(placeDetails.opening_hours) : null,
        photos: placeDetails.photos ? {
          createMany: {
            data: placeDetails.photos.slice(0, 5).map((photo) => ({
              photoRef: photo.photo_reference,
              width: photo.width,
              height: photo.height,
            })),
          },
        } : undefined,
        reviews: placeDetails.reviews ? {
          createMany: {
            data: placeDetails.reviews.map((review) => ({
              authorName: review.author_name,
              rating: review.rating,
              text: review.text,
              time: new Date(review.time * 1000),
              relativeTime: review.relative_time_description,
            })),
          },
        } : undefined,
        assignedTo: currentUserId,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'NEW',
            notes: 'Prospect created',
            changedBy: currentUserId,
          },
        },
      },
      include: {
        photos: true,
        reviews: true,
        statusHistory: true,
      },
    })

    // Auto-trigger web analysis if prospect has a website
    if (prospect.website) {
      let url = prospect.website.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`
      }
      triggerBackgroundAnalysis(prospect.id, url).catch((err) => {
        console.error('Failed to trigger background analysis:', err)
      })
    }

    return NextResponse.json(prospect, { status: 201 })
  } catch (error) {
    console.error('Create prospect error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create prospect' },
      { status: 500 }
    )
  }
}
