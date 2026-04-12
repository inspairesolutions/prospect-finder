'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatRelativeTime, truncate } from '@/lib/utils'
import { Prospect } from '@/types'
import { useUpdateProspectStatus, useDiscardPlace } from '@/hooks/use-prospects'

interface ProspectCardProps {
  prospect: Prospect & {
    photos?: Array<{ id: string; photoRef: string; url?: string | null }>
    assignedUser?: { id: string; name: string; email: string } | null
    _count?: { reviews: number; files: number }
  }
}

export function ProspectCard({ prospect }: ProspectCardProps) {
  const types = JSON.parse(prospect.types || '[]') as string[]
  const primaryType = types[0]?.replace(/_/g, ' ') || 'Negocio'
  const { mutate: updateStatus } = useUpdateProspectStatus()
  const { mutate: discardPlace } = useDiscardPlace()

  const handleDiscard = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Set status to ARCHIVED (which also auto-discards via status API)
    updateStatus({ id: prospect.id, status: 'ARCHIVED' })
    // Also discard the placeId directly in case status call is slow
    if (prospect.placeId) {
      discardPlace(prospect.placeId)
    }
  }

  const isDiscarded = prospect.status === 'ARCHIVED'

  return (
    <div className="relative group">
      <Link href={`/prospects/${prospect.id}`}>
        <Card hover className={`p-4 h-full ${isDiscarded ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center flex-shrink-0 text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-900 truncate">{prospect.name}</h3>
                <Badge status={prospect.status} />
              </div>
              <p className="text-sm text-slate-500 truncate mt-0.5">
                {truncate(prospect.formattedAddress, 50)}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                {prospect.googleRating && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {prospect.googleRating.toFixed(1)}
                  </span>
                )}
                <span className="capitalize">{primaryType}</span>
                {prospect.website && (
                  <span className="text-green-600">Con web</span>
                )}
                {!prospect.website && (
                  <span className="text-amber-600">Sin web</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {formatRelativeTime(prospect.createdAt)}
              </span>
              {prospect.assignedUser && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-slate-500"
                  title={`Asignado a ${prospect.assignedUser.name}`}
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                    {prospect.assignedUser.name[0]?.toUpperCase()}
                  </span>
                  <span className="truncate max-w-[80px]">{prospect.assignedUser.name.split(' ')[0]}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {prospect._count?.files ? (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {prospect._count.files}
                </span>
              ) : null}
              {prospect.notes && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </Card>
      </Link>

      {/* Discard button — visible on hover, bottom-right corner */}
      {!isDiscarded && (
        <button
          onClick={handleDiscard}
          title="Descartar (no aparecerá en futuras búsquedas)"
          className="absolute bottom-3 right-3 p-1.5 rounded-md text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all z-10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </button>
      )}
    </div>
  )
}
