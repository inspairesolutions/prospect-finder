'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card } from '@/components/ui/card'
import { useSearchStore } from '@/store/search'
import { useSearch } from '@/hooks/use-search'
import { formatRelativeTime } from '@/lib/utils'

interface SearchHistoryItem {
  id: string
  query: string
  category: string | null
  location: string
  latitude: number
  longitude: number
  radius: number
  resultsCount: number
  createdAt: string
}

export function SearchHistory() {
  const { setQuery, setCategory, setLocation, setRadius } = useSearchStore()
  const { mutate: search } = useSearch()

  const { data: searches, isLoading } = useQuery({
    queryKey: ['search-history'],
    queryFn: async () => {
      const response = await axios.get('/api/searches?limit=10')
      return response.data as SearchHistoryItem[]
    },
  })

  const handleReuse = (item: SearchHistoryItem) => {
    setQuery(item.query || '')
    setCategory(item.category || '')
    setLocation(item.location, item.latitude, item.longitude)
    setRadius(item.radius)

    // Trigger search immediately
    search({
      query: item.query || undefined,
      category: item.category || undefined,
      location: item.location,
      latitude: item.latitude,
      longitude: item.longitude,
      radius: item.radius,
    })
  }

  const getCategoryLabel = (category: string | null) => {
    const labels: Record<string, string> = {
      restaurant: 'Restaurantes',
      store: 'Tiendas',
      beauty_salon: 'Salones de belleza',
      gym: 'Gimnasios',
      dentist: 'Dentistas',
      doctor: 'Doctores',
      lawyer: 'Abogados',
      accounting: 'Contadores',
      real_estate_agency: 'Inmobiliarias',
      car_dealer: 'Concesionarios',
      jewelry_store: 'Joyerías',
      florist: 'Floristerías',
      bakery: 'Panaderías',
      cafe: 'Cafeterías',
    }
    return category ? labels[category] || category : null
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </Card>
    )
  }

  if (!searches || searches.length === 0) {
    return null
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700">Búsquedas recientes</h3>
        <span className="text-xs text-slate-400">{searches.length} búsquedas</span>
      </div>
      <div className="space-y-2">
        {searches.map((item) => (
          <button
            key={item.id}
            onClick={() => handleReuse(item)}
            className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.query && (
                    <span className="text-sm font-medium text-slate-900">&quot;{item.query}&quot;</span>
                  )}
                  {getCategoryLabel(item.category) && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {getCategoryLabel(item.category)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="truncate">{item.location}</span>
                  <span className="text-slate-300">·</span>
                  <span>{item.radius / 1000}km</span>
                  <span className="text-slate-300">·</span>
                  <span>{item.resultsCount} resultados</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-slate-400">{formatRelativeTime(item.createdAt)}</span>
                <svg
                  className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
