// Simple in-memory cache with TTL
interface CacheEntry<T> {
  data: T
  expiry: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private defaultTTL: number = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

  set<T>(key: string, data: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs || this.defaultTTL)
    this.cache.set(key, { data, expiry })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined

    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now()
    const keysToDelete: string[] = []
    this.cache.forEach((entry, key) => {
      if (now > entry.expiry) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach((key) => this.cache.delete(key))
  }
}

// Create cache key from search parameters
export function createSearchCacheKey(params: {
  query?: string
  category?: string
  latitude: number
  longitude: number
  radius: number
}): string {
  return `search:${params.query || ''}:${params.category || ''}:${params.latitude.toFixed(4)}:${params.longitude.toFixed(4)}:${params.radius}`
}

// Create cache key for place details
export function createPlaceDetailsCacheKey(placeId: string): string {
  return `place:${placeId}`
}

// Singleton instance
export const searchCache = new MemoryCache()

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    searchCache.cleanup()
  }, 10 * 60 * 1000)
}
