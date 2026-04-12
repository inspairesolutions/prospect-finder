'use client'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useProspectsStore } from '@/store/prospects'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'NEW', label: 'Nuevo' },
  { value: 'IN_CONSTRUCTION', label: 'En Construccion' },
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'INTERESTED', label: 'Interesado' },
  { value: 'NOT_INTERESTED', label: 'No Interesado' },
  { value: 'READY', label: 'Listo' },
  { value: 'CONVERTED', label: 'Convertido' },
  { value: 'ARCHIVED', label: 'Archivado' },
]

const sortOptions = [
  { value: 'createdAt', label: 'Fecha de creacion' },
  { value: 'updatedAt', label: 'Ultima actualizacion' },
  { value: 'name', label: 'Nombre' },
  { value: 'googleRating', label: 'Rating' },
  { value: 'priority', label: 'Prioridad' },
]

const websiteOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Con web' },
  { value: 'false', label: 'Sin web' },
]

export function ProspectFilters() {
  const { filters, setFilters, resetFilters, viewMode, setViewMode } = useProspectsStore()
  const { data: session } = useSession()

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* My Prospects toggle */}
        {session?.user && (
          <button
            onClick={() => setFilters({ onlyMine: !filters.onlyMine })}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
              filters.onlyMine
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Mis prospectos
          </button>
        )}

        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por nombre o direccion..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </div>

        <div className="w-40">
          <Select
            value={filters.status?.toString() || ''}
            onChange={(e) => setFilters({ status: e.target.value as never || undefined })}
            options={statusOptions}
          />
        </div>

        <div className="w-32">
          <Select
            value={filters.hasWebsite === null ? '' : filters.hasWebsite?.toString() || ''}
            onChange={(e) => {
              const val = e.target.value
              setFilters({ hasWebsite: val === '' ? null : val === 'true' })
            }}
            options={websiteOptions}
          />
        </div>

        <div className="w-44">
          <Select
            value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as typeof filters.sortBy })}
            options={sortOptions}
          />
        </div>

        <button
          onClick={() => setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600"
          title={filters.sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
        >
          <svg
            className={cn('w-5 h-5 transition-transform', filters.sortOrder === 'asc' && 'rotate-180')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </button>

        <Button variant="ghost" onClick={resetFilters}>
          Limpiar
        </Button>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-2 rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
