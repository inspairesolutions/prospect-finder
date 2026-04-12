const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

export interface PlaceSearchResult {
  place_id: string
  name: string
  formatted_address?: string
  vicinity?: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  rating?: number
  user_ratings_total?: number
  price_level?: number
  business_status?: string
  types?: string[]
  opening_hours?: {
    open_now?: boolean
  }
  photos?: Array<{
    photo_reference: string
    width: number
    height: number
  }>
}

export interface PlaceDetails {
  place_id: string
  name: string
  formatted_address: string
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  url?: string // Google Maps URL
  rating?: number
  user_ratings_total?: number
  price_level?: number
  business_status?: string
  types?: string[]
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  opening_hours?: {
    open_now?: boolean
    weekday_text?: string[]
  }
  reviews?: Array<{
    author_name: string
    rating: number
    text: string
    time: number
    relative_time_description: string
  }>
  photos?: Array<{
    photo_reference: string
    width: number
    height: number
  }>
}

export interface NearbySearchParams {
  location: { lat: number; lng: number }
  radius: number // in meters
  type?: string
  keyword?: string
}

export interface TextSearchParams {
  query: string
  location?: { lat: number; lng: number }
  radius?: number
}

class GooglePlacesService {
  private apiKey: string
  private baseUrl = 'https://maps.googleapis.com/maps/api/place'

  constructor() {
    if (!GOOGLE_PLACES_API_KEY) {
      console.warn('GOOGLE_PLACES_API_KEY is not set')
    }
    this.apiKey = GOOGLE_PLACES_API_KEY || ''
  }

  async nearbySearch(params: NearbySearchParams): Promise<PlaceSearchResult[]> {
    const url = new URL(`${this.baseUrl}/nearbysearch/json`)
    url.searchParams.set('location', `${params.location.lat},${params.location.lng}`)
    url.searchParams.set('radius', params.radius.toString())
    url.searchParams.set('key', this.apiKey)

    if (params.type) {
      url.searchParams.set('type', params.type)
    }
    if (params.keyword) {
      url.searchParams.set('keyword', params.keyword)
    }

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ''}`)
    }

    return data.results || []
  }

  async textSearch(params: TextSearchParams): Promise<PlaceSearchResult[]> {
    const url = new URL(`${this.baseUrl}/textsearch/json`)
    url.searchParams.set('query', params.query)
    url.searchParams.set('key', this.apiKey)

    if (params.location) {
      url.searchParams.set('location', `${params.location.lat},${params.location.lng}`)
    }
    if (params.radius) {
      url.searchParams.set('radius', params.radius.toString())
    }

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ''}`)
    }

    return data.results || []
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    const url = new URL(`${this.baseUrl}/details/json`)
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('fields', [
      'place_id',
      'name',
      'formatted_address',
      'formatted_phone_number',
      'international_phone_number',
      'website',
      'url',
      'rating',
      'user_ratings_total',
      'price_level',
      'business_status',
      'types',
      'geometry',
      'opening_hours',
      'reviews',
      'photos',
    ].join(','))

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status === 'NOT_FOUND') {
      return null
    }

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || ''}`)
    }

    return data.result
  }

  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`
  }
}

export const googlePlaces = new GooglePlacesService()
export default googlePlaces
