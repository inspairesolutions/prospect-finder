'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useSearchStore, SearchResult, filterSearchResults } from '@/store/search'
import { useCreateProspect, useDiscardedPlaces, useDiscardPlace } from '@/hooks/use-prospects'
import { cn } from '@/lib/utils'
import axios from 'axios'

const libraries: ('places')[] = ['places']

interface PlaceDetails {
  phone: string | null
  website: string | null
  googleMapsUrl: string | null
  openingHours: string[] | null
}

function SearchResultCard({ result, onAdd, prospectId, onDiscard, isDiscarded }: { result: SearchResult; onAdd: (prospectId: string) => void; prospectId?: string; onDiscard: () => void; isDiscarded?: boolean }) {
  const { mutate: createProspect, isPending } = useCreateProspect()
  const [isExpanded, setIsExpanded] = useState(false)
  const [details, setDetails] = useState<PlaceDetails | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  const handleAdd = () => {
    createProspect(result.placeId, {
      onSuccess: (data) => onAdd(data.id),
    })
  }

  const isAdded = result.isAlreadyProspect || !!prospectId

  const handleExpand = async () => {
    if (isExpanded) {
      setIsExpanded(false)
      return
    }

    setIsExpanded(true)

    if (!details) {
      setIsLoadingDetails(true)
      try {
        const response = await axios.get(`/api/places/${result.placeId}`)
        setDetails({
          phone: response.data.phone,
          website: response.data.website,
          googleMapsUrl: response.data.googleMapsUrl,
          openingHours: response.data.openingHours,
        })
      } catch (error) {
        console.error('Error fetching place details:', error)
      } finally {
        setIsLoadingDetails(false)
      }
    }
  }

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <Card className={cn('p-4', isDiscarded && 'opacity-50')}>
      {isDiscarded && (
        <div className="flex items-center gap-1 mb-2 text-xs text-amber-600 font-medium">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          Descartado
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 truncate">{result.name}</h3>
          <p className="text-sm text-slate-500 truncate">{result.address}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {result.rating && (
              <span className="flex items-center gap-1 text-sm text-slate-600">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {result.rating.toFixed(1)}
              </span>
            )}
            {result.reviewCount !== undefined && (
              <span className="text-xs text-slate-400">({result.reviewCount} reseñas)</span>
            )}
            {result.isOpen !== undefined && (
              <Badge variant="outline" className={result.isOpen ? 'text-green-600' : 'text-red-600'}>
                {result.isOpen ? 'Abierto' : 'Cerrado'}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {isAdded ? (
            prospectId ? (
              <Link href={`/prospects/${prospectId}`}>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer flex items-center gap-1">
                  Ver prospecto
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Badge>
              </Link>
            ) : (
              <Badge className="bg-green-100 text-green-800">Agregado</Badge>
            )
          ) : (
            <Button
              size="sm"
              onClick={handleAdd}
              isLoading={isPending}
            >
              Agregar
            </Button>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleExpand}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              {isExpanded ? 'Menos' : 'Más info'}
              <svg
                className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onDiscard}
              title="Descartar — no aparecerá en futuras búsquedas"
              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {isLoadingDetails ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Cargando detalles...
            </div>
          ) : details ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {details.phone ? (
                  <a href={`tel:${details.phone}`} className="text-primary-600 hover:underline">
                    {details.phone}
                  </a>
                ) : (
                  <span className="text-amber-600">Sin teléfono</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {details.website ? (
                  <a
                    href={details.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline truncate"
                  >
                    {extractDomain(details.website)}
                  </a>
                ) : (
                  <span className="text-amber-600 font-medium">Sin sitio web</span>
                )}
              </div>

              {details.googleMapsUrl && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <a
                    href={details.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline text-xs"
                  >
                    Ver en Google Maps
                  </a>
                </div>
              )}

              {details.openingHours && details.openingHours.length > 0 && (
                <div className="sm:col-span-2 mt-2">
                  <p className="text-xs text-slate-500 mb-1">Horario:</p>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {details.openingHours.slice(0, 3).map((hour, i) => (
                      <p key={i}>{hour}</p>
                    ))}
                    {details.openingHours.length > 3 && (
                      <p className="text-slate-400">...y más</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No se pudieron cargar los detalles</p>
          )}
        </div>
      )}
    </Card>
  )
}

function ResultsMap({ results, selectedId, onSelect }: {
  results: SearchResult[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { latitude, longitude } = useSearchStore()

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  })

  if (!isLoaded || !latitude || !longitude) return null

  const selectedResult = results.find((r) => r.placeId === selectedId)

  return (
    <GoogleMap
      zoom={13}
      center={{ lat: latitude, lng: longitude }}
      mapContainerClassName="w-full h-full rounded-xl"
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      }}
    >
      {results.map((result) => (
        <Marker
          key={result.placeId}
          position={{ lat: result.latitude, lng: result.longitude }}
          onClick={() => onSelect(result.placeId)}
          icon={{
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: result.isAlreadyProspect ? '#22c55e' : '#0891b2',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.5,
            anchor: new google.maps.Point(12, 24),
          }}
        />
      ))}

      {selectedResult && (
        <InfoWindow
          position={{ lat: selectedResult.latitude, lng: selectedResult.longitude }}
          onCloseClick={() => onSelect(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-medium text-slate-900">{selectedResult.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{selectedResult.address}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}

export function SearchResults() {
  const { results, isLoading, filters } = useSearchStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'split' | 'list' | 'map'>('split')
  // Map of placeId -> prospectId for newly added prospects
  const [addedProspects, setAddedProspects] = useState<Map<string, string>>(new Map())
  // Locally discarded placeIds (optimistic)
  const [localDiscarded, setLocalDiscarded] = useState<Set<string>>(new Set())
  // Show/hide discarded results
  const [showDiscarded, setShowDiscarded] = useState(false)

  const { data: discardedPlaceIds = [] } = useDiscardedPlaces()
  const { mutate: discardPlace } = useDiscardPlace()

  const discardedSet = new Set([...discardedPlaceIds, ...Array.from(localDiscarded)])

  const handleAdd = (placeId: string, prospectId: string) => {
    setAddedProspects((prev) => new Map(prev).set(placeId, prospectId))
  }

  const handleDiscard = (placeId: string) => {
    setLocalDiscarded((prev) => new Set(prev).add(placeId))
    discardPlace(placeId)
  }

  // Update results with local "added" state
  const updatedResults = results.map((r) => ({
    ...r,
    isAlreadyProspect: r.isAlreadyProspect || addedProspects.has(r.placeId),
    isDiscarded: discardedSet.has(r.placeId),
  }))

  const discardedCount = updatedResults.filter((r) => r.isDiscarded).length

  // Apply filters to results (always exclude discarded unless showDiscarded is on)
  const visibleResults = showDiscarded
    ? updatedResults
    : updatedResults.filter((r) => !r.isDiscarded)

  const filteredResults = filterSearchResults(visibleResults, filters)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Buscando negocios...
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        title="Realiza una búsqueda"
        description="Ingresa una ubicación y categoría o palabra clave para encontrar negocios."
      />
    )
  }

  const hasActiveFilters = filters.maxRating !== null ||
    filters.minRating !== null ||
    filters.businessStatus !== null ||
    filters.maxReviews !== null ||
    filters.minReviews !== null ||
    filters.hideAlreadyAdded

  if (filteredResults.length === 0 && hasActiveFilters) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        }
        title="Sin resultados"
        description={`Ninguno de los ${results.length} resultados coincide con los filtros seleccionados. Prueba a ajustar los filtros.`}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {hasActiveFilters ? (
            <>
              {filteredResults.length} de {updatedResults.length} resultado{updatedResults.length !== 1 ? 's' : ''}
              <span className="text-slate-400"> (filtrado)</span>
            </>
          ) : (
            <>
              {updatedResults.length} resultado{updatedResults.length !== 1 ? 's' : ''} encontrado{updatedResults.length !== 1 ? 's' : ''}
            </>
          )}
          {discardedCount > 0 && (
            <button
              onClick={() => setShowDiscarded((v) => !v)}
              className="ml-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              · {discardedCount} descartado{discardedCount !== 1 ? 's' : ''}
              <span
                className={cn(
                  'relative inline-flex h-3.5 w-6 flex-shrink-0 rounded-full border transition-colors duration-200',
                  showDiscarded
                    ? 'bg-amber-400 border-amber-400'
                    : 'bg-slate-200 border-slate-200'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-2 w-2 rounded-full bg-white shadow transition-transform duration-200',
                    showDiscarded ? 'translate-x-3' : 'translate-x-0.5'
                  )}
                />
              </span>
              {showDiscarded ? 'visibles' : 'ocultos'}
            </button>
          )}
        </p>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(['split', 'list', 'map'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === mode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {mode === 'split' && 'Dividido'}
              {mode === 'list' && 'Lista'}
              {mode === 'map' && 'Mapa'}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        'grid gap-4',
        viewMode === 'split' && 'lg:grid-cols-2',
        viewMode === 'list' && 'grid-cols-1',
        viewMode === 'map' && 'grid-cols-1'
      )}>
        {viewMode !== 'map' && (
          <div className={cn(
            'space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin pr-2',
            viewMode === 'split' && 'lg:max-h-[600px]'
          )}>
            {filteredResults.map((result) => (
              <div
                key={result.placeId}
                onMouseEnter={() => setSelectedId(result.placeId)}
                onMouseLeave={() => setSelectedId(null)}
              >
                <SearchResultCard
                  result={result}
                  onAdd={(prospectId) => handleAdd(result.placeId, prospectId)}
                  prospectId={addedProspects.get(result.placeId)}
                  onDiscard={() => handleDiscard(result.placeId)}
                  isDiscarded={(result as unknown as { isDiscarded?: boolean }).isDiscarded}
                />
              </div>
            ))}
          </div>
        )}

        {viewMode !== 'list' && (
          <div className={cn(
            'h-[600px] rounded-xl overflow-hidden border border-slate-200',
            viewMode === 'map' && 'h-[700px]'
          )}>
            <ResultsMap
              results={filteredResults}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        )}
      </div>
    </div>
  )
}
