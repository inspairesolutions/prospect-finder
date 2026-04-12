import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get all searches ordered by date
    const allSearches = await prisma.search.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        query: true,
        category: true,
        location: true,
        latitude: true,
        longitude: true,
        radius: true,
        resultsCount: true,
        createdAt: true,
      },
    })

    // Deduplicate by parameters, keeping only the most recent
    const seen = new Map<string, typeof allSearches[0]>()
    const duplicateIds: string[] = []

    for (const search of allSearches) {
      // Create a unique key based on search parameters
      const key = `${search.query}:${search.category}:${search.latitude.toFixed(4)}:${search.longitude.toFixed(4)}:${search.radius}`

      if (seen.has(key)) {
        // This is a duplicate (older), mark for deletion
        duplicateIds.push(search.id)
      } else {
        // First occurrence (most recent due to ordering)
        seen.set(key, search)
      }
    }

    // Delete duplicates in background (don't wait)
    if (duplicateIds.length > 0) {
      prisma.search.deleteMany({
        where: { id: { in: duplicateIds } }
      }).catch(err => console.error('Error deleting duplicate searches:', err))
    }

    // Return unique searches, limited
    const uniqueSearches = Array.from(seen.values()).slice(0, limit)

    return NextResponse.json(uniqueSearches)
  } catch (error) {
    console.error('Get searches error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch search history' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      await prisma.search.delete({ where: { id } })
    } else {
      // Delete all search history
      await prisma.search.deleteMany()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete search error:', error)
    return NextResponse.json(
      { error: 'Failed to delete search' },
      { status: 500 }
    )
  }
}
