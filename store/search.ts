import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface SearchResult {
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
  // Extended details (loaded on demand)
  phone?: string | null
  website?: string | null
  photosCount?: number
}

export interface SearchFilters {
  maxRating: number | null        // Rating 4.4 or Less
  minRating: number | null        // Min rating filter
  businessStatus: string | null   // OPERATIONAL, CLOSED, etc.
  hasWebsite: boolean | null      // true = with, false = without, null = any
  hasPhone: boolean | null        // true = with, false = without, null = any
  maxReviews: number | null       // 100 Reviews or Less
  minReviews: number | null       // 100 Reviews or More
  hideAlreadyAdded: boolean       // Hide prospects already added
}

interface SearchState {
  // Search params
  query: string
  category: string
  location: string
  latitude: number | null
  longitude: number | null
  radius: number

  // Filters (applied client-side)
  filters: SearchFilters

  // Results
  results: SearchResult[]
  isLoading: boolean
  error: string | null

  // Actions
  setQuery: (query: string) => void
  setCategory: (category: string) => void
  setLocation: (location: string, lat: number, lng: number) => void
  clearLocation: () => void
  setRadius: (radius: number) => void
  setFilters: (filters: Partial<SearchFilters>) => void
  resetFilters: () => void
  setResults: (results: SearchResult[]) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const defaultFilters: SearchFilters = {
  maxRating: null,
  minRating: null,
  businessStatus: null,
  hasWebsite: null,
  hasPhone: null,
  maxReviews: null,
  minReviews: null,
  hideAlreadyAdded: false,
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      query: '',
      category: '',
      location: '',
      latitude: null,
      longitude: null,
      radius: 5000,

      filters: defaultFilters,

      results: [],
      isLoading: false,
      error: null,

      setQuery: (query) => set({ query }),
      setCategory: (category) => set({ category }),
      setLocation: (location, latitude, longitude) => set({ location, latitude, longitude }),
      clearLocation: () => set({ location: '', latitude: null, longitude: null }),
      setRadius: (radius) => set({ radius }),
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters }
      })),
      resetFilters: () => set({ filters: defaultFilters }),
      setResults: (results) => set({ results, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      reset: () =>
        set({
          query: '',
          category: '',
          location: '',
          latitude: null,
          longitude: null,
          radius: 5000,
          filters: defaultFilters,
          results: [],
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: 'search-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist these fields (not isLoading or error)
      partialize: (state) => ({
        query: state.query,
        category: state.category,
        location: state.location,
        latitude: state.latitude,
        longitude: state.longitude,
        radius: state.radius,
        filters: state.filters,
        results: state.results,
      }),
    }
  )
)

// Helper function to filter results based on filters
export function filterSearchResults(results: SearchResult[], filters: SearchFilters): SearchResult[] {
  return results.filter((result) => {
    // Rating filter (max)
    if (filters.maxRating !== null && result.rating !== undefined) {
      if (result.rating > filters.maxRating) return false
    }

    // Rating filter (min)
    if (filters.minRating !== null && result.rating !== undefined) {
      if (result.rating < filters.minRating) return false
    }

    // Business status filter
    if (filters.businessStatus !== null && result.businessStatus) {
      if (result.businessStatus !== filters.businessStatus) return false
    }

    // Reviews count filter (max)
    if (filters.maxReviews !== null && result.reviewCount !== undefined) {
      if (result.reviewCount > filters.maxReviews) return false
    }

    // Reviews count filter (min)
    if (filters.minReviews !== null && result.reviewCount !== undefined) {
      if (result.reviewCount < filters.minReviews) return false
    }

    // Hide already added
    if (filters.hideAlreadyAdded && result.isAlreadyProspect) {
      return false
    }

    // Note: hasWebsite and hasPhone filters require fetching place details
    // These are handled separately in the UI after details are loaded

    return true
  })
}
