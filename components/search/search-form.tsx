'use client'

import { useState, useCallback, useEffect } from 'react'
import { useLoadScript } from '@react-google-maps/api'
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useSearchStore } from '@/store/search'
import { useSearch } from '@/hooks/use-search'
import { cn } from '@/lib/utils'

const libraries: ('places')[] = ['places']

const categories = [
  { value: '', label: 'Todas las categorías' },
  { value: 'restaurant', label: 'Restaurantes' },
  { value: 'store', label: 'Tiendas' },
  { value: 'beauty_salon', label: 'Salones de belleza' },
  { value: 'gym', label: 'Gimnasios' },
  { value: 'dentist', label: 'Dentistas' },
  { value: 'doctor', label: 'Doctores' },
  { value: 'lawyer', label: 'Abogados' },
  { value: 'accounting', label: 'Contadores' },
  { value: 'real_estate_agency', label: 'Inmobiliarias' },
  { value: 'car_dealer', label: 'Concesionarios' },
  { value: 'jewelry_store', label: 'Joyerías' },
  { value: 'florist', label: 'Floristerías' },
  { value: 'bakery', label: 'Panaderías' },
  { value: 'cafe', label: 'Cafeterías' },
]

const radiusOptions = [
  { value: '1000', label: '1 km' },
  { value: '2000', label: '2 km' },
  { value: '5000', label: '5 km' },
  { value: '10000', label: '10 km' },
  { value: '20000', label: '20 km' },
]

function LocationAutocomplete() {
  const { setLocation, clearLocation, location } = useSearchStore()

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    debounce: 300,
    requestOptions: {
      componentRestrictions: { country: 'es' },
    },
  })

  const handleSelect = useCallback(
    async (description: string) => {
      setValue(description, false)
      clearSuggestions()

      try {
        const results = await getGeocode({ address: description })
        const { lat, lng } = await getLatLng(results[0])
        setLocation(description, lat, lng)
      } catch (error) {
        console.error('Error getting geocode:', error)
      }
    },
    [setValue, clearSuggestions, setLocation]
  )

  useEffect(() => {
    setValue(location || '', false)
    if (!location) {
      clearSuggestions()
    }
  }, [location, setValue, clearSuggestions])

  return (
    <div className="relative">
      <Input
        label="Ubicación"
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value
          setValue(nextValue)
          if (!nextValue.trim() || nextValue !== location) {
            clearLocation()
          }
        }}
        disabled={!ready}
        placeholder="Ej: Tres Cantos, Madrid"
      />
      {status === 'OK' && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              onClick={() => handleSelect(description)}
              className="px-4 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700"
            >
              {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
        active
          ? 'bg-primary-100 border-primary-300 text-primary-700'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
      )}
    >
      {label}
    </button>
  )
}

export function SearchForm() {
  const [isExpanded, setIsExpanded] = useState(false)
  const {
    query,
    category,
    latitude,
    longitude,
    radius,
    location,
    isLoading,
    filters,
    setQuery,
    setCategory,
    setRadius,
    setFilters,
    resetFilters,
    reset,
  } = useSearchStore()

  const { mutate: search } = useSearch()

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  })

  const handleSearch = () => {
    if (!latitude || !longitude) {
      return
    }

    search({
      query: query || undefined,
      category: category || undefined,
      location,
      latitude,
      longitude,
      radius,
    })
  }

  const activeFiltersCount = [
    filters.maxRating !== null,
    filters.minRating !== null,
    filters.businessStatus !== null,
    filters.hasWebsite !== null,
    filters.hasPhone !== null,
    filters.maxReviews !== null,
    filters.minReviews !== null,
    filters.hideAlreadyAdded,
  ].filter(Boolean).length

  if (!isLoaded) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-visible">
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Palabra clave"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: joyería, peluquería"
          />

          <Select
            label="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categories}
          />

          <LocationAutocomplete />

          <Select
            label="Radio de búsqueda"
            value={radius.toString()}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            options={radiusOptions}
          />
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Filtros de resultados</h4>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Limpiar filtros ({activeFiltersCount})
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Rating filters */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Rating</p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label="≤ 4.4 estrellas"
                    active={filters.maxRating === 4.4}
                    onClick={() => setFilters({ maxRating: filters.maxRating === 4.4 ? null : 4.4 })}
                  />
                  <FilterChip
                    label="≤ 4.0 estrellas"
                    active={filters.maxRating === 4.0}
                    onClick={() => setFilters({ maxRating: filters.maxRating === 4.0 ? null : 4.0 })}
                  />
                  <FilterChip
                    label="≥ 4.0 estrellas"
                    active={filters.minRating === 4.0}
                    onClick={() => setFilters({ minRating: filters.minRating === 4.0 ? null : 4.0 })}
                  />
                  <FilterChip
                    label="Sin rating"
                    active={filters.maxRating === 0}
                    onClick={() => setFilters({ maxRating: filters.maxRating === 0 ? null : 0 })}
                  />
                </div>
              </div>

              {/* Business status */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Estado del negocio</p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label="Operativo"
                    active={filters.businessStatus === 'OPERATIONAL'}
                    onClick={() => setFilters({ businessStatus: filters.businessStatus === 'OPERATIONAL' ? null : 'OPERATIONAL' })}
                  />
                  <FilterChip
                    label="Cerrado temporalmente"
                    active={filters.businessStatus === 'CLOSED_TEMPORARILY'}
                    onClick={() => setFilters({ businessStatus: filters.businessStatus === 'CLOSED_TEMPORARILY' ? null : 'CLOSED_TEMPORARILY' })}
                  />
                </div>
              </div>

              {/* Reviews count */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Cantidad de reseñas</p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label="≤ 100 reseñas"
                    active={filters.maxReviews === 100}
                    onClick={() => setFilters({ maxReviews: filters.maxReviews === 100 ? null : 100 })}
                  />
                  <FilterChip
                    label="> 100 reseñas"
                    active={filters.minReviews === 101}
                    onClick={() => setFilters({ minReviews: filters.minReviews === 101 ? null : 101 })}
                  />
                  <FilterChip
                    label="≤ 50 reseñas"
                    active={filters.maxReviews === 50}
                    onClick={() => setFilters({ maxReviews: filters.maxReviews === 50 ? null : 50 })}
                  />
                  <FilterChip
                    label="≤ 10 reseñas"
                    active={filters.maxReviews === 10}
                    onClick={() => setFilters({ maxReviews: filters.maxReviews === 10 ? null : 10 })}
                  />
                </div>
              </div>

              {/* Other filters */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Otros</p>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label="Ocultar ya agregados"
                    active={filters.hideAlreadyAdded}
                    onClick={() => setFilters({ hideAlreadyAdded: !filters.hideAlreadyAdded })}
                  />
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-2">
                Nota: Los filtros de &quot;Con/Sin Web&quot; y &quot;Con/Sin Teléfono&quot; se muestran en los detalles de cada resultado (botón &quot;Más info&quot;).
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isExpanded ? 'Menos filtros' : 'Más filtros'}
            {activeFiltersCount > 0 && !isExpanded && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={reset}
              disabled={isLoading}
            >
              Nueva búsqueda
            </Button>

            <Button
              onClick={handleSearch}
              isLoading={isLoading}
              disabled={!latitude || !longitude || (!query && !category)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
