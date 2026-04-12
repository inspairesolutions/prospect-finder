'use client'

import { ProspectCard } from './prospect-card'
import { ProspectCardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useProspects } from '@/hooks/use-prospects'
import { useProspectsStore } from '@/store/prospects'
import { cn } from '@/lib/utils'
import { Prospect } from '@/types'
import Link from 'next/link'

type ProspectWithMeta = Prospect & {
  photos?: Array<{ id: string; photoRef: string; url?: string | null }>
  _count?: { reviews: number; files: number }
}

export function ProspectList() {
  const { data, isLoading, error } = useProspects()
  const { viewMode, page, setPage } = useProspectsStore()

  if (isLoading) {
    return (
      <div className={cn(
        'grid gap-4',
        viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
      )}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProspectCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        title="Error al cargar prospectos"
        description="Ocurrió un error al cargar los prospectos. Intenta de nuevo."
        action={
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        }
      />
    )
  }

  if (!data?.data.length) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
        title="No hay prospectos"
        description="Comienza buscando negocios para agregar como prospectos."
        action={
          <Link href="/search">
            <Button>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Buscar negocios
            </Button>
          </Link>
        }
      />
    )
  }

  const { pagination } = data

  return (
    <div className="space-y-6">
      <div className={cn(
        'grid gap-4',
        viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
      )}>
        {data.data.map((prospect: ProspectWithMeta) => (
          <ProspectCard key={prospect.id} prospect={prospect} />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            Mostrando {(page - 1) * pagination.limit + 1} - {Math.min(page * pagination.limit, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-slate-600 px-2">
              {page} / {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
