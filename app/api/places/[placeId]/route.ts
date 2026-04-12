import { NextRequest, NextResponse } from 'next/server'
import googlePlaces from '@/lib/google-places'
import { searchCache, createPlaceDetailsCacheKey } from '@/lib/cache'

const CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await params

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      )
    }

    // Check cache first
    const cacheKey = createPlaceDetailsCacheKey(placeId)
    const cached = searchCache.get(cacheKey)

    if (cached) {
      console.log('Cache hit for place details:', placeId)
      return NextResponse.json(cached)
    }

    console.log('Cache miss, fetching place details:', placeId)
    const details = await googlePlaces.getPlaceDetails(placeId)

    if (!details) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      )
    }

    const result = {
      placeId: details.place_id,
      name: details.name,
      address: details.formatted_address,
      phone: details.formatted_phone_number || details.international_phone_number || null,
      website: details.website || null,
      googleMapsUrl: details.url || null,
      rating: details.rating,
      reviewCount: details.user_ratings_total,
      priceLevel: details.price_level,
      businessStatus: details.business_status,
      types: details.types || [],
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      openingHours: details.opening_hours?.weekday_text || null,
      isOpen: details.opening_hours?.open_now,
      photos: details.photos?.slice(0, 5).map((p) => ({
        reference: p.photo_reference,
        width: p.width,
        height: p.height,
      })) || [],
      reviews: details.reviews?.slice(0, 5).map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.time,
        relativeTime: r.relative_time_description,
      })) || [],
    }

    // Cache the result
    searchCache.set(cacheKey, result, CACHE_TTL)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get place details error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get place details' },
      { status: 500 }
    )
  }
}
