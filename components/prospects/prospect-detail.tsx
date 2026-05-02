'use client'

import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { StatusTimeline } from './status-timeline'
import { FileUploader } from './file-uploader'
import { UserAssignment } from './user-assignment'
import { useProspect, useUpdateProspect, useUpdateProspectStatus, useDeleteProspect, useDiscardPlace } from '@/hooks/use-prospects'
import { ProspectDetailSkeleton } from '@/components/ui/skeleton'
import { formatDate, getStatusLabel, extractDomain } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { IntelligenceBlock } from './intelligence-block'
import { LandingsBlock } from './landings-block'
import { CommunicationBlock } from './communication-block'
import { ProspectStatus } from '@prisma/client'

const statusOptions: ProspectStatus[] = [
  'NEW',
  'IN_CONSTRUCTION',
  'CONTACTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'READY',
  'CONVERTED',
  'ARCHIVED',
]

interface ProspectDetailProps {
  id: string
}

export function ProspectDetail({ id }: ProspectDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: prospect, isLoading, error } = useProspect(id)
  const { mutate: updateProspect } = useUpdateProspect()
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateProspectStatus()
  const { mutate: deleteProspect, isPending: isDeleting } = useDeleteProspect()
  const { mutate: discardPlace } = useDiscardPlace()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  const handleStatusChange = (status: ProspectStatus) => {
    updateStatus(
      { id, status },
      {
        onSuccess: () => setShowStatusModal(false),
      }
    )
  }

  const handleDelete = () => {
    deleteProspect(id, {
      onSuccess: () => router.push('/prospects'),
    })
  }

  const handleDiscard = () => {
    updateStatus(
      { id, status: 'ARCHIVED' },
      {
        onSuccess: () => {
          if (prospect?.placeId) discardPlace(prospect.placeId)
          setShowDiscardModal(false)
        },
      }
    )
  }

  if (isLoading) {
    return <ProspectDetailSkeleton />
  }

  if (error || !prospect) {
    return (
      <Card className="p-6">
        <p className="text-red-600">Error al cargar el prospecto</p>
      </Card>
    )
  }

  const types = JSON.parse(prospect.types || '[]') as string[]
  const intelTab = searchParams.get('intel') || 'research'
  const landingsTab = searchParams.get('landings') || ''
  const commsTab = searchParams.get('comms') || 'thread'

  const setTabParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.replace(`/prospects/${id}?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="overflow-visible">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{prospect.name}</h2>
                <p className="text-slate-500 mt-1">{prospect.formattedAddress}</p>
                <div className="flex items-center gap-3 mt-3">
                  <button onClick={() => setShowStatusModal(true)}>
                    <Badge status={prospect.status} className="cursor-pointer hover:opacity-80" />
                  </button>
                  <UserAssignment
                    assignedTo={prospect.assignedTo}
                    assignedUser={prospect.assignedUser}
                    onAssign={(userId) => updateProspect({ id, data: { assignedTo: userId } })}
                  />
                  {prospect.googleRating && (
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {prospect.googleRating.toFixed(1)} ({prospect.googleReviewCount} reseñas)
                    </span>
                  )}
                  {types.slice(0, 2).map((type) => (
                    <Badge key={type} variant="outline" className="capitalize">
                      {type.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                  <p>Telefono: <span className="text-slate-700">{prospect.phone || 'No disponible'}</span></p>
                  <p>
                    Sitio:{' '}
                    {prospect.website ? (
                      <a href={prospect.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        {extractDomain(prospect.website)}
                      </a>
                    ) : (
                      <span className="text-slate-700">Sin sitio web</span>
                    )}
                  </p>
                  <p>Estado negocio: <span className="text-slate-700">{prospect.businessStatus || 'No disponible'}</span></p>
                  <p>Agregado: <span className="text-slate-700">{formatDate(prospect.createdAt)}</span></p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {prospect.status !== 'ARCHIVED' && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  onClick={() => setShowDiscardModal(true)}
                  title="Descartar prospecto"
                  aria-label="Descartar prospecto"
                >
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon
                onClick={() => setShowDeleteModal(true)}
                title="Eliminar prospecto"
                aria-label="Eliminar prospecto"
              >
                <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
              {prospect.googleMapsUrl && (
                <a href={prospect.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm" type="button">
                    Ver en Maps
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <IntelligenceBlock
            prospectId={id}
            prospect={prospect}
            value={intelTab}
            onValueChange={(value) => setTabParam('intel', value)}
          />
          <LandingsBlock
            prospectId={id}
            hasEnoughData={!!(prospect.description || prospect.services)}
            favoriteUrl={prospect.proposedWebUrl}
            onSelectFavorite={(url) => updateProspect({ id, data: { proposedWebUrl: url } })}
            value={landingsTab}
            onValueChange={(value) => setTabParam('landings', value)}
          />
          <CommunicationBlock
            prospectId={id}
            prospectName={prospect.name}
            prospectEmail={prospect.contactEmail ?? undefined}
            hasWebsite={!!prospect.website}
            hasProposedUrl={!!prospect.proposedWebUrl}
            value={commsTab}
            onValueChange={(value) => setTabParam('comms', value)}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Historial de estado</h3>
            </CardHeader>
            <CardContent>
              <StatusTimeline history={prospect.statusHistory || []} />
            </CardContent>
          </Card>

          {/* Reviews */}
          {prospect.reviews && prospect.reviews.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Reseñas de Google</h3>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin">
                {prospect.reviews.map((review) => (
                  <div key={review.id} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${i < review.rating ? 'text-amber-400' : 'text-slate-200'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">{review.relativeTime}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700">{review.authorName}</p>
                    {review.text && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3">{review.text}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Archivos</h3>
            </CardHeader>
            <CardContent>
              <FileUploader prospectId={id} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Cambiar estado"
        size="sm"
      >
        <div className="space-y-2">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={isUpdatingStatus}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                prospect.status === status
                  ? 'bg-primary-50 text-primary-700 border-2 border-primary-500'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </Modal>

      {/* Discard Modal */}
      <Modal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        title="Descartar prospecto"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-amber-100 flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Descartar &quot;{prospect.name}&quot;</p>
              <p className="text-sm text-slate-500 mt-1">
                El prospecto se marcará como <strong>Archivado</strong> y su placeId quedará en la lista de descartados.
                No volverá a aparecer en futuras búsquedas.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDiscardModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleDiscard}
              isLoading={isUpdatingStatus}
            >
              Descartar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar prospecto"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ¿Estás seguro de que deseas eliminar este prospecto? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
