import { NextRequest, NextResponse } from 'next/server'
import googlePlaces from '@/lib/google-places'
import prisma from '@/lib/prisma'
import { searchCache, createSearchCacheKey } from '@/lib/cache'

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

interface CachedSearchResult {
  results: TransformedResult[]
  timestamp: number
}

interface TransformedResult {
  placeId: string
  name: string
  address: string
  latitude: number
  longitude: number
  rating?: number
  reviewCount?: number
  priceLevel?: number
  businessStatus?: string
  types: string[]
  isOpen?: boolean
  photo?: string
  isAlreadyProspect: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, category, location, latitude, longitude, radius = 5000 } = body

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Location coordinates are required' },
        { status: 400 }
      )
    }

    if (!query && !category) {
      return NextResponse.json(
        { error: 'Either query or category is required' },
        { status: 400 }
      )
    }

    // Check cache first
    const cacheKey = createSearchCacheKey({ query, category, latitude, longitude, radius })
    const cached = searchCache.get<CachedSearchResult>(cacheKey)

    let results

    if (cached) {
      console.log('Cache hit for search:', cacheKey)
      results = cached.results

      // Still need to update isAlreadyProspect status
      const existingPlaceIds = await prisma.prospect.findMany({
        where: {
          placeId: {
            in: results.map((r: TransformedResult) => r.placeId),
          },
        },
        select: { placeId: true },
      })
      const existingSet = new Set(existingPlaceIds.map((p) => p.placeId))
      results = results.map((r: TransformedResult) => ({
        ...r,
        isAlreadyProspect: existingSet.has(r.placeId),
      }))
    } else {
      console.log('Cache miss, fetching from Google Places:', cacheKey)

      let googleResults

      if (query) {
        const searchQuery = category ? `${category} ${query}` : query
        googleResults = await googlePlaces.textSearch({
          query: `${searchQuery} near ${location}`,
          location: { lat: latitude, lng: longitude },
          radius,
        })
      } else {
        googleResults = await googlePlaces.nearbySearch({
          location: { lat: latitude, lng: longitude },
          radius,
          type: category.toLowerCase().replace(/\s+/g, '_'),
        })
      }

      // Get existing prospect place_ids
      const existingPlaceIds = await prisma.prospect.findMany({
        where: {
          placeId: {
            in: googleResults.map((r) => r.place_id),
          },
        },
        select: { placeId: true },
      })
      const existingSet = new Set(existingPlaceIds.map((p) => p.placeId))

      // Transform results
      results = googleResults.map((place) => ({
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity || '',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        priceLevel: place.price_level,
        businessStatus: place.business_status,
        types: place.types || [],
        isOpen: place.opening_hours?.open_now,
        photo: place.photos?.[0]?.photo_reference,
        isAlreadyProspect: existingSet.has(place.place_id),
      }))

      // Cache the results (without isAlreadyProspect as it may change)
      const cacheResults = results.map((r: TransformedResult) => ({ ...r, isAlreadyProspect: false }))
      searchCache.set(cacheKey, { results: cacheResults, timestamp: Date.now() }, CACHE_TTL)

      // Save search to history (upsert to avoid duplicates with same parameters)
      // Find existing search with same parameters
      const existingSearch = await prisma.search.findFirst({
        where: {
          query: query || category || '',
          category: category || null,
          latitude,
          longitude,
          radius,
        },
      })

      if (existingSearch) {
        // Update existing search timestamp and results count
        await prisma.search.update({
          where: { id: existingSearch.id },
          data: {
            createdAt: new Date(),
            resultsCount: googleResults.length,
            location: location || '',
          },
        })
      } else {
        // Create new search entry
        await prisma.search.create({
          data: {
            query: query || category || '',
            category,
            location: location || '',
            latitude,
            longitude,
            radius,
            resultsCount: googleResults.length,
          },
        })
      }
    }

    return NextResponse.json({
      results,
      total: results.length,
      cached: !!cached,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}
