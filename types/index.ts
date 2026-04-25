import { ProspectStatus } from '@prisma/client'

export type { ProspectStatus }

export interface Prospect {
  id: string
  createdAt: Date
  updatedAt: Date
  placeId: string
  name: string
  formattedAddress: string
  latitude: number
  longitude: number
  googleRating: number | null
  googleReviewCount: number | null
  priceLevel: number | null
  businessStatus: string | null
  types: string
  phone: string | null
  website: string | null
  googleMapsUrl: string | null
  openingHours: string | null
  vicinity: string | null
  status: ProspectStatus
  notes: string | null
  logoUrl: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  description: string | null
  services: string | null
  uniqueSellingPoints: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  preferredWebStyle: string | null
  proposedWebUrl: string | null
  contactEmail: string | null
  priority: number
  assignedTo: string | null
  assignedUser?: { id: string; name: string; email: string } | null
  lastContactedAt: Date | null
  nextFollowUpAt: Date | null
  searchId: string | null
  webAnalysis: string | null
  webAnalysisScore: number | null
  webAnalysisCategory: string | null
  webContentExtract: string | null
  photos?: ProspectPhoto[]
  reviews?: ProspectReview[]
  files?: ProspectFile[]
  statusHistory?: StatusHistory[]
  emailProposals?: EmailProposal[]
  emailThreads?: EmailThread[]
}

export interface EmailProposal {
  id: string
  createdAt: Date
  subject: string
  body: string
  variant: string
  sentAt: Date | null
  threadId: string | null
  prospectId: string
}

export interface EmailMessage {
  id: string
  createdAt: Date
  direction: 'outbound' | 'inbound'
  fromEmail: string
  fromName: string | null
  toEmail: string
  subject: string
  bodyHtml: string
  bodyText: string | null
  messageId: string | null
  inReplyTo: string | null
  openTrackingToken: string | null
  openedAt: Date | null
  openedHumanAt: Date | null
  openCount: number
  humanOpenCount: number
  firstOpenUserAgent: string | null
  firstOpenIp: string | null
  readAt: Date | null
  threadId: string
}

export interface EmailThread {
  id: string
  createdAt: Date
  updatedAt: Date
  subject: string
  toEmail: string
  toName: string | null
  status: string
  prospectId: string
  messages?: EmailMessage[]
  lastMessage?: EmailMessage | null
  unreadCount?: number
}

export interface GeneratedEmailVariant {
  id: string
  name: string
  subject: string
  body: string
}

export interface GeneratedEmailResult {
  type: 'renovation' | 'new'
  variants: GeneratedEmailVariant[]
}

export interface ProspectPhoto {
  id: string
  createdAt: Date
  photoRef: string
  url: string | null
  width: number | null
  height: number | null
  prospectId: string
}

export interface ProspectReview {
  id: string
  createdAt: Date
  authorName: string
  rating: number
  text: string | null
  time: Date
  relativeTime: string | null
  prospectId: string
}

export interface ProspectFile {
  id: string
  createdAt: Date
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
  prospectId: string
}

export interface ProspectSite {
  id: string
  createdAt: Date
  label: string
  slug: string
  publicUrl: string
  source: 'upload' | 'generated'
  fileCount: number
  prospectId: string
}

export interface StatusHistory {
  id: string
  createdAt: Date
  fromStatus: ProspectStatus | null
  toStatus: ProspectStatus
  notes: string | null
  changedBy: string | null
  prospectId: string
}

export interface Search {
  id: string
  createdAt: Date
  query: string
  category: string | null
  location: string
  latitude: number
  longitude: number
  radius: number
  resultsCount: number
}

export interface SearchFilters {
  status?: ProspectStatus | ProspectStatus[]
  hasWebsite?: boolean
  hasPhone?: boolean
  minRating?: number
  maxRating?: number
  category?: string
  search?: string
  sortBy?: 'createdAt' | 'name' | 'rating' | 'priority' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface Stats {
  total: number
  byStatus: Record<ProspectStatus, number>
  recentActivity: Array<{
    id: string
    type: 'created' | 'updated' | 'status_changed'
    prospectId: string
    prospectName: string
    timestamp: Date
    details?: string
  }>
  thisWeek: number
  thisMonth: number
}

export interface GooglePlaceResult {
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

export interface CreateProspectInput {
  placeId: string
  name: string
  formattedAddress: string
  latitude: number
  longitude: number
  googleRating?: number | null
  googleReviewCount?: number | null
  priceLevel?: number | null
  businessStatus?: string | null
  types: string[]
  phone?: string | null
  website?: string | null
  googleMapsUrl?: string | null
  openingHours?: object | null
  vicinity?: string | null
  photos?: Array<{
    photoRef: string
    width?: number
    height?: number
  }>
  reviews?: Array<{
    authorName: string
    rating: number
    text?: string
    time: Date
    relativeTime?: string
  }>
}

export interface UpdateProspectInput {
  notes?: string | null
  logoUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  linkedinUrl?: string | null
  twitterUrl?: string | null
  description?: string | null
  services?: string | null
  uniqueSellingPoints?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  preferredWebStyle?: string | null
  proposedWebUrl?: string | null
  contactEmail?: string | null
  priority?: number
  assignedTo?: string | null
  lastContactedAt?: Date | null
  nextFollowUpAt?: Date | null
}

/**
 * Structured prospect data for website design/creation.
 * GET /api/prospects/[id]/website
 */
export interface ProspectWebsiteData {
  // Core business identity
  business: {
    name: string
    description: string | null
    tagline: string | null
    types: string[]
    category: string | null
    services: string | null
    businessStatus: string | null
  }

  // Contact information
  contact: {
    phone: string | null
    website: string | null
    email: string | null
    address: {
      full: string
      short: string | null
      coordinates: {
        lat: number
        lng: number
      }
    }
    googleMapsUrl: string | null
    googleMapsEmbed: string | null
  }

  // Social media links
  social: {
    facebook: string | null
    instagram: string | null
    linkedin: string | null
    twitter: string | null
    hasAnySocial: boolean
  }

  // Visual branding
  branding: {
    logo: string | null
    colors: {
      primary: string | null
      secondary: string | null
      accent: string | null
    }
    cssVariables: {
      '--color-primary': string
      '--color-secondary': string
      '--color-accent': string
    }
    preferredStyle: string | null
    hasCustomBranding: boolean
  }

  // Reviews and ratings
  reputation: {
    rating: number | null
    ratingOutOf: 5
    reviewCount: number | null
    priceLevel: number | null
    priceLevelText: string | null
    testimonials: Array<{
      author: string
      rating: number
      text: string | null
      date: Date
      relativeTime: string | null
    }>
    stats: {
      hasHighRating: boolean
      hasSignificantReviews: boolean
      trustScore: number
    }
  }

  // Photos and media
  media: {
    photos: Array<{
      id: string
      url: string | null
      reference: string
      dimensions: { width: number; height: number } | null
      suggestedUse: 'hero' | 'gallery' | 'additional'
    }>
    heroImage: string | null
    galleryImages: string[]
    totalPhotos: number
  }

  // Opening hours
  schedule: {
    weekdayText: string[] | null
    periods: Array<{
      open: { day: number; time: string }
      close?: { day: number; time: string }
    }> | null
    formatted: {
      today: string | null
      summary: string
      full: string[]
    } | null
  }

  // Technical metadata
  meta: {
    id: string
    placeId: string
    createdAt: Date
    updatedAt: Date
    prospectStatus: ProspectStatus
    dataCompleteness: {
      score: number
      missing: string[]
    }
  }
}
