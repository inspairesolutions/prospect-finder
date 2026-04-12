'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { StatusTimeline } from './status-timeline'
import { FileUploader } from './file-uploader'
import { WebAnalysis } from './web-analysis'
import { EmailThreadPanel } from './email-thread'
import { SiteGenerator } from './site-generator'
import { LandingGenerator } from './landing-generator'
import { SiteManager } from './site-manager'
import { UserAssignment } from './user-assignment'
import { useProspect, useUpdateProspect, useUpdateProspectStatus, useDeleteProspect, useDiscardPlace } from '@/hooks/use-prospects'
import { ProspectDetailSkeleton } from '@/components/ui/skeleton'
import { formatDate, getStatusLabel, extractDomain } from '@/lib/utils'
import { useRouter } from 'next/navigation'
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
  const queryClient = useQueryClient()
  const { data: prospect, isLoading, error } = useProspect(id)
  const { mutate: updateProspect, isPending: isUpdating } = useUpdateProspect()
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateProspectStatus()
  const { mutate: deleteProspect, isPending: isDeleting } = useDeleteProspect()
  const { mutate: discardPlace } = useDiscardPlace()

  const [isEditing, setIsEditing] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [researchSummary, setResearchSummary] = useState<string[] | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [formData, setFormData] = useState({
    notes: '',
    description: '',
    services: '',
    uniqueSellingPoints: '',
    contactEmail: '',
    facebookUrl: '',
    instagramUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    primaryColor: '',
    secondaryColor: '',
    accentColor: '',
    preferredWebStyle: '',
    proposedWebUrl: '',
  })

  const fieldLabels: Record<string, string> = {
    description: 'Descripción',
    services: 'Servicios',
    uniqueSellingPoints: 'Propuesta de valor',
    contactEmail: 'Email de contacto',
    facebookUrl: 'Facebook',
    instagramUrl: 'Instagram',
    linkedinUrl: 'LinkedIn',
    twitterUrl: 'Twitter/X',
    primaryColor: 'Color primario',
    secondaryColor: 'Color secundario',
    accentColor: 'Color acento',
    preferredWebStyle: 'Estilo web',
  }

  const handleResearch = async () => {
    setIsResearching(true)
    setResearchSummary(null)
    try {
      const { data } = await axios.post(`/api/prospects/${id}/research`)
      queryClient.invalidateQueries({ queryKey: ['prospect', id] })
      const labels = (data.filledFields as string[]).map(
        (f) => fieldLabels[f] ?? f
      )
      setResearchSummary(labels)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al investigar'
      setResearchSummary([`Error: ${msg}`])
    } finally {
      setIsResearching(false)
    }
  }

  const handleEdit = () => {
    if (prospect) {
      setFormData({
        notes: prospect.notes || '',
        description: prospect.description || '',
        services: prospect.services || '',
        uniqueSellingPoints: prospect.uniqueSellingPoints || '',
        contactEmail: prospect.contactEmail || '',
        facebookUrl: prospect.facebookUrl || '',
        instagramUrl: prospect.instagramUrl || '',
        linkedinUrl: prospect.linkedinUrl || '',
        twitterUrl: prospect.twitterUrl || '',
        primaryColor: prospect.primaryColor || '',
        secondaryColor: prospect.secondaryColor || '',
        accentColor: prospect.accentColor || '',
        preferredWebStyle: prospect.preferredWebStyle || '',
        proposedWebUrl: prospect.proposedWebUrl || '',
      })
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    updateProspect(
      { id, data: formData },
      {
        onSuccess: () => setIsEditing(false),
      }
    )
  }

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
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prospect.status !== 'ARCHIVED' && (
                <Button
                  variant="ghost"
                  onClick={() => setShowDiscardModal(true)}
                  title="Descartar prospecto"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowDeleteModal(true)}>
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
              {prospect.googleMapsUrl && (
                <a href={prospect.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ver en Maps
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Google Info (Read-only) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Información de Google</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Teléfono</p>
                  <p className="text-sm text-slate-900">{prospect.phone || 'No disponible'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Sitio web</p>
                  {prospect.website ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {extractDomain(prospect.website)}
                    </a>
                  ) : (
                    <p className="text-sm text-amber-600 font-medium">Sin sitio web</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Estado del negocio</p>
                  <p className="text-sm text-slate-900">{prospect.businessStatus || 'No disponible'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Agregado</p>
                  <p className="text-sm text-slate-900">{formatDate(prospect.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Web Analysis */}
          <WebAnalysis prospectId={id} website={prospect.website} />

          {/* Research Fields */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="font-semibold text-slate-900">Investigación</h3>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResearch}
                    isLoading={isResearching}
                    disabled={isResearching}
                  >
                    {!isResearching && (
                      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
                      </svg>
                    )}
                    Investigar con IA
                  </Button>
                )}
                {!isEditing ? (
                  <Button variant="secondary" size="sm" onClick={handleEdit}>
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSave} isLoading={isUpdating}>
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Research result banner */}
              {researchSummary && (
                <div className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
                  researchSummary[0]?.startsWith('Error:')
                    ? 'bg-red-50 text-red-700'
                    : 'bg-green-50 text-green-700'
                }`}>
                  {researchSummary[0]?.startsWith('Error:') ? (
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div>
                    {researchSummary[0]?.startsWith('Error:') ? (
                      <p>{researchSummary[0]}</p>
                    ) : (
                      <>
                        <p className="font-medium">{researchSummary.length} campo{researchSummary.length !== 1 ? 's' : ''} completado{researchSummary.length !== 1 ? 's' : ''}</p>
                        <p className="text-xs mt-0.5 text-green-600">{researchSummary.join(', ')}</p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setResearchSummary(null)}
                    className="ml-auto text-current opacity-50 hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Researching progress indicator */}
              {isResearching && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analizando el negocio con IA...
                </div>
              )}

              {isEditing ? (
                <div className="space-y-4">
                  <Input
                    label="URL web propuesta"
                    value={formData.proposedWebUrl}
                    onChange={(e) => setFormData({ ...formData, proposedWebUrl: e.target.value })}
                    placeholder="https://inspaire.es/propuesta/..."
                  />
                  <Input
                    label="Email de contacto"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="info@negocio.com"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Facebook"
                      value={formData.facebookUrl}
                      onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                      placeholder="https://facebook.com/..."
                    />
                    <Input
                      label="Instagram"
                      value={formData.instagramUrl}
                      onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/..."
                    />
                    <Input
                      label="LinkedIn"
                      value={formData.linkedinUrl}
                      onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/..."
                    />
                    <Input
                      label="Twitter"
                      value={formData.twitterUrl}
                      onChange={(e) => setFormData({ ...formData, twitterUrl: e.target.value })}
                      placeholder="https://twitter.com/..."
                    />
                  </div>
                  <div>
                    <label className="label">Descripción</label>
                    <textarea
                      className="input min-h-[100px]"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descripción del negocio..."
                    />
                  </div>
                  <div>
                    <label className="label">Servicios</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={formData.services}
                      onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                      placeholder="Lista de servicios..."
                    />
                  </div>
                  <div>
                    <label className="label">Propuesta de valor</label>
                    <textarea
                      className="input min-h-[80px]"
                      value={formData.uniqueSellingPoints}
                      onChange={(e) => setFormData({ ...formData, uniqueSellingPoints: e.target.value })}
                      placeholder="¿Qué hace único a este negocio?"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Color primario</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.primaryColor || '#000000'}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                        />
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Color secundario</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.secondaryColor || '#000000'}
                          onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                          className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                        />
                        <Input
                          value={formData.secondaryColor}
                          onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Color acento</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.accentColor || '#000000'}
                          onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                          className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                        />
                        <Input
                          value={formData.accentColor}
                          onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Notas</label>
                    <textarea
                      className="input min-h-[100px]"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {prospect.proposedWebUrl && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Web propuesta</p>
                      <a
                        href={prospect.proposedWebUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:underline break-all"
                      >
                        {prospect.proposedWebUrl}
                      </a>
                    </div>
                  )}
                  {prospect.contactEmail && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Email de contacto</p>
                      <a
                        href={`mailto:${prospect.contactEmail}`}
                        className="text-sm text-primary-600 hover:underline"
                      >
                        {prospect.contactEmail}
                      </a>
                    </div>
                  )}
                  {(prospect.facebookUrl || prospect.instagramUrl || prospect.linkedinUrl || prospect.twitterUrl) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Redes sociales</p>
                      <div className="flex gap-2">
                        {prospect.facebookUrl && (
                          <a href={prospect.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          </a>
                        )}
                        {prospect.instagramUrl && (
                          <a href={prospect.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-pink-100 text-pink-600 hover:bg-pink-200">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                          </a>
                        )}
                        {prospect.linkedinUrl && (
                          <a href={prospect.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                          </a>
                        )}
                        {prospect.twitterUrl && (
                          <a href={prospect.twitterUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-sky-100 text-sky-600 hover:bg-sky-200">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {prospect.description && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Descripción</p>
                      <p className="text-sm text-slate-700">{prospect.description}</p>
                    </div>
                  )}
                  {prospect.services && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Servicios</p>
                      <p className="text-sm text-slate-700">{prospect.services}</p>
                    </div>
                  )}
                  {prospect.uniqueSellingPoints && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Propuesta de valor</p>
                      <p className="text-sm text-slate-700">{prospect.uniqueSellingPoints}</p>
                    </div>
                  )}
                  {(prospect.primaryColor || prospect.secondaryColor || prospect.accentColor) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Colores de marca</p>
                      <div className="flex gap-2">
                        {prospect.primaryColor && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded border" style={{ backgroundColor: prospect.primaryColor }} />
                            <span className="text-xs text-slate-500">{prospect.primaryColor}</span>
                          </div>
                        )}
                        {prospect.secondaryColor && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded border" style={{ backgroundColor: prospect.secondaryColor }} />
                            <span className="text-xs text-slate-500">{prospect.secondaryColor}</span>
                          </div>
                        )}
                        {prospect.accentColor && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded border" style={{ backgroundColor: prospect.accentColor }} />
                            <span className="text-xs text-slate-500">{prospect.accentColor}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {prospect.notes && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Notas</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{prospect.notes}</p>
                    </div>
                  )}
                  {!prospect.proposedWebUrl && !prospect.contactEmail && !prospect.description && !prospect.services && !prospect.notes && (
                    <p className="text-sm text-slate-400 italic">No hay información de investigación aún. Haz clic en Editar para agregar.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Landing Generator — API directa de Anthropic (HTML autocontenido) */}
          <LandingGenerator
            prospectId={id}
            hasEnoughData={!!(prospect.description || prospect.services)}
          />

          {/* Site Generator — builds landing page via Claude Code CLI */}
          <SiteGenerator
            prospectId={id}
            hasEnoughData={!!(prospect.description || prospect.services)}
          />

          {/* Landings del prospecto */}
          <SiteManager prospectId={id} />

          {/* Email threads (Odoo/Salesforce style) */}
          <EmailThreadPanel
            prospectId={id}
            prospectName={prospect.name}
            prospectEmail={prospect.contactEmail ?? undefined}
            hasWebsite={!!prospect.website}
            hasProposedUrl={!!prospect.proposedWebUrl}
          />

          {/* Files */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Archivos</h3>
            </CardHeader>
            <CardContent>
              <FileUploader prospectId={id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
