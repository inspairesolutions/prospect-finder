import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/prospects/[id]/website
 *
 * Returns prospect data structured for website design/creation.
 * The JSON is organized by sections that map to typical website components.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          orderBy: { rating: 'desc' },
          take: 10, // Best reviews for testimonials
        },
      },
    })

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields safely
    const parseJsonField = (field: string | null): unknown => {
      if (!field) return null
      try {
        return JSON.parse(field)
      } catch {
        return field
      }
    }

    const types = parseJsonField(prospect.types) as string[] | null
    const openingHours = parseJsonField(prospect.openingHours) as {
      weekday_text?: string[]
      periods?: Array<{
        open: { day: number; time: string }
        close?: { day: number; time: string }
      }>
    } | null

    // Structure the response for web design purposes
    const websiteData = {
      // === BUSINESS IDENTITY ===
      // Core information about who they are and what they do
      business: {
        name: prospect.name,
        description: prospect.description,
        tagline: prospect.uniqueSellingPoints, // Can be used as hero tagline
        types: types || [],
        category: types?.[0] || null, // Primary category
        services: prospect.services,
        businessStatus: prospect.businessStatus,
      },

      // === CONTACT INFORMATION ===
      // How visitors can reach or find the business
      contact: {
        phone: prospect.phone,
        website: prospect.website,
        email: null, // Not available from Google Places
        address: {
          full: prospect.formattedAddress,
          short: prospect.vicinity,
          coordinates: {
            lat: prospect.latitude,
            lng: prospect.longitude,
          },
        },
        googleMapsUrl: prospect.googleMapsUrl,
        googleMapsEmbed: prospect.latitude && prospect.longitude
          ? `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${prospect.latitude},${prospect.longitude}`
          : null,
      },

      // === SOCIAL MEDIA ===
      // Links to social profiles for footer/header
      social: {
        facebook: prospect.facebookUrl,
        instagram: prospect.instagramUrl,
        linkedin: prospect.linkedinUrl,
        twitter: prospect.twitterUrl,
        // Computed: has any social presence
        hasAnySocial: !!(
          prospect.facebookUrl ||
          prospect.instagramUrl ||
          prospect.linkedinUrl ||
          prospect.twitterUrl
        ),
      },

      // === BRANDING & DESIGN ===
      // Visual identity for styling the website
      branding: {
        logo: prospect.logoUrl,
        colors: {
          primary: prospect.primaryColor,
          secondary: prospect.secondaryColor,
          accent: prospect.accentColor,
        },
        // CSS custom properties ready to use
        cssVariables: {
          '--color-primary': prospect.primaryColor || '#3B82F6',
          '--color-secondary': prospect.secondaryColor || '#1E40AF',
          '--color-accent': prospect.accentColor || '#F59E0B',
        },
        preferredStyle: prospect.preferredWebStyle,
        // Computed: has custom branding defined
        hasCustomBranding: !!(
          prospect.primaryColor ||
          prospect.secondaryColor ||
          prospect.accentColor
        ),
      },

      // === REPUTATION & SOCIAL PROOF ===
      // Reviews and ratings for testimonials section
      reputation: {
        rating: prospect.googleRating,
        ratingOutOf: 5,
        reviewCount: prospect.googleReviewCount,
        priceLevel: prospect.priceLevel,
        priceLevelText: prospect.priceLevel
          ? ['', 'Económico', 'Moderado', 'Caro', 'Muy caro'][prospect.priceLevel]
          : null,
        // Top reviews for testimonials (already sorted by rating desc)
        testimonials: prospect.reviews.map((review) => ({
          author: review.authorName,
          rating: review.rating,
          text: review.text,
          date: review.time,
          relativeTime: review.relativeTime,
        })),
        // Stats for trust badges
        stats: {
          hasHighRating: (prospect.googleRating || 0) >= 4.0,
          hasSignificantReviews: (prospect.googleReviewCount || 0) >= 10,
          trustScore: calculateTrustScore(
            prospect.googleRating,
            prospect.googleReviewCount
          ),
        },
      },

      // === MEDIA & GALLERY ===
      // Photos for hero, gallery, about sections
      media: {
        photos: prospect.photos.map((photo, index) => ({
          id: photo.id,
          url: photo.url,
          reference: photo.photoRef,
          dimensions: photo.width && photo.height
            ? { width: photo.width, height: photo.height }
            : null,
          // Suggested usage based on position
          suggestedUse: index === 0 ? 'hero' : index < 4 ? 'gallery' : 'additional',
        })),
        // Quick access
        heroImage: prospect.photos[0]?.url || null,
        galleryImages: prospect.photos.slice(0, 6).map((p) => p.url).filter(Boolean),
        totalPhotos: prospect.photos.length,
      },

      // === SCHEDULE & AVAILABILITY ===
      // Opening hours for contact/footer section
      schedule: {
        // Human-readable schedule
        weekdayText: openingHours?.weekday_text || null,
        // Structured periods for custom display
        periods: openingHours?.periods || null,
        // Formatted for quick display
        formatted: openingHours?.weekday_text
          ? formatOpeningHours(openingHours.weekday_text)
          : null,
      },

      // === METADATA ===
      // Technical information
      meta: {
        id: prospect.id,
        placeId: prospect.placeId,
        createdAt: prospect.createdAt,
        updatedAt: prospect.updatedAt,
        prospectStatus: prospect.status,
        dataCompleteness: calculateDataCompleteness(prospect),
      },
    }

    return NextResponse.json(websiteData)
  } catch (error) {
    console.error('Get prospect website data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prospect data' },
      { status: 500 }
    )
  }
}

/**
 * Calculate a trust score based on rating and review count
 */
function calculateTrustScore(
  rating: number | null,
  reviewCount: number | null
): number {
  if (!rating || !reviewCount) return 0

  // Weight: 60% rating, 40% review volume (capped at 100 reviews)
  const ratingScore = (rating / 5) * 60
  const volumeScore = Math.min(reviewCount / 100, 1) * 40

  return Math.round(ratingScore + volumeScore)
}

/**
 * Format opening hours into a compact structure
 */
function formatOpeningHours(weekdayText: string[]): {
  today: string | null
  summary: string
  full: string[]
} {
  const todayIndex = new Date().getDay()

  // Find today's hours (weekday_text is Monday-Sunday, JS Date is Sunday-Saturday)
  const todayText = weekdayText[(todayIndex + 6) % 7] || null

  // Create a summary (e.g., "Lun-Vie: 9-18h")
  const summary = createScheduleSummary(weekdayText)

  return {
    today: todayText,
    summary,
    full: weekdayText,
  }
}

/**
 * Create a compact summary of the schedule
 */
function createScheduleSummary(weekdayText: string[]): string {
  if (!weekdayText || weekdayText.length === 0) return 'Horario no disponible'

  // Check if all days have the same hours
  const hours = weekdayText.map((day) => day.split(': ')[1])
  const uniqueHours = Array.from(new Set(hours))

  if (uniqueHours.length === 1) {
    return `Todos los días: ${uniqueHours[0]}`
  }

  // Check for weekday pattern (Mon-Fri)
  const weekdayHours = hours.slice(0, 5)

  if (new Set(weekdayHours).size === 1 && weekdayHours[0]) {
    return `Lun-Vie: ${weekdayHours[0]}`
  }

  return 'Ver horario completo'
}

/**
 * Calculate how complete the prospect data is (0-100)
 */
function calculateDataCompleteness(prospect: {
  description?: string | null
  phone?: string | null
  website?: string | null
  logoUrl?: string | null
  services?: string | null
  primaryColor?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  photos: unknown[]
  reviews: unknown[]
}): {
  score: number
  missing: string[]
} {
  const fields = [
    { key: 'description', label: 'Descripción', weight: 15 },
    { key: 'phone', label: 'Teléfono', weight: 10 },
    { key: 'website', label: 'Sitio web', weight: 10 },
    { key: 'logoUrl', label: 'Logo', weight: 15 },
    { key: 'services', label: 'Servicios', weight: 15 },
    { key: 'primaryColor', label: 'Color primario', weight: 10 },
    { key: 'facebookUrl', label: 'Facebook', weight: 5 },
    { key: 'instagramUrl', label: 'Instagram', weight: 5 },
  ]

  let score = 0
  const missing: string[] = []

  for (const field of fields) {
    const value = prospect[field.key as keyof typeof prospect]
    if (value && value !== '') {
      score += field.weight
    } else {
      missing.push(field.label)
    }
  }

  // Bonus for photos
  if (prospect.photos.length > 0) score += 10
  else missing.push('Fotos')

  // Bonus for reviews
  if (prospect.reviews.length > 0) score += 5
  else missing.push('Reseñas')

  return { score: Math.min(score, 100), missing }
}
