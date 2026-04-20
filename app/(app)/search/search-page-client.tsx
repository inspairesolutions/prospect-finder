'use client'

import { SearchForm } from '@/components/search/search-form'
import { SearchResults } from '@/components/search/search-results'
import { SearchHistory } from '@/components/search/search-history'
import { useSearchStore } from '@/store/search'

export function SearchPageClient({ googleMapsApiKey }: { googleMapsApiKey: string }) {
  const { results } = useSearchStore()

  return (
    <div className="space-y-6">
      {!googleMapsApiKey.trim() && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Falta la clave de Google Maps en el servidor. Define en DigitalOcean (Run time){' '}
          <code className="rounded bg-amber-100/80 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>,{' '}
          <code className="rounded bg-amber-100/80 px-1">GOOGLE_MAPS_BROWSER_API_KEY</code> o{' '}
          <code className="rounded bg-amber-100/80 px-1">GOOGLE_PLACES_API_KEY</code>, y vuelve a desplegar.
        </div>
      )}
      <SearchForm googleMapsApiKey={googleMapsApiKey} />

      {results.length === 0 && (
        <SearchHistory />
      )}

      <SearchResults googleMapsApiKey={googleMapsApiKey} />
    </div>
  )
}
