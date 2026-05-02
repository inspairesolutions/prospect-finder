'use client'

import { useState } from 'react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Prospect } from '@/types'
import { useUpdateProspect } from '@/hooks/use-prospects'
import toast from 'react-hot-toast'

interface ResearchPanelProps {
  prospectId: string
  prospect: Prospect
}

const fieldLabels: Record<string, string> = {
  description: 'Descripcion',
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

export function ResearchPanel({ prospectId, prospect }: ResearchPanelProps) {
  const queryClient = useQueryClient()
  const { mutate: updateProspect, isPending: isUpdating } = useUpdateProspect()
  const [isEditing, setIsEditing] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [researchSummary, setResearchSummary] = useState<string[] | null>(null)
  const [formData, setFormData] = useState({
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

  const handleResearch = async () => {
    setIsResearching(true)
    setResearchSummary(null)
    try {
      const { data } = await axios.post(`/api/prospects/${prospectId}/research`)
      queryClient.invalidateQueries({ queryKey: ['prospect', prospectId] })
      const labels = (data.filledFields as string[]).map((f) => fieldLabels[f] ?? f)
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

  const handleSave = () => {
    updateProspect(
      { id: prospectId, data: formData },
      {
        onSuccess: () => setIsEditing(false),
      }
    )
  }

  const copyBusinessInfo = () => {
    const lines: string[] = []
    lines.push(`NEGOCIO: ${prospect.name}`)
    lines.push(`Direccion: ${prospect.formattedAddress}`)
    if (prospect.phone) lines.push(`Telefono: ${prospect.phone}`)
    if (prospect.website) lines.push(`Web: ${prospect.website}`)
    if (prospect.contactEmail) lines.push(`Email: ${prospect.contactEmail}`)
    if (prospect.notes) lines.push(`Notas:\n${prospect.notes}`)
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Informacion copiada al portapapeles')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-500">
          Datos del negocio (descripcion, servicios, contacto, branding)
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
        {!isEditing && (
          <>
            <Button variant="ghost" size="sm" onClick={copyBusinessInfo}>Copiar</Button>
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
            <Button variant="primary" size="sm" onClick={handleResearch} isLoading={isResearching}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Investigar con IA
            </Button>
          </>
        )}
        {isEditing && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancelar</Button>
            <Button variant="secondary" size="sm" onClick={handleSave} isLoading={isUpdating}>Guardar</Button>
          </>
        )}
        </div>
      </div>

      {researchSummary && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {researchSummary.join(', ')}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-4">
          <Input label="URL web propuesta" value={formData.proposedWebUrl} onChange={(e) => setFormData({ ...formData, proposedWebUrl: e.target.value })} />
          <Input label="Email de contacto" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
          <div>
            <label className="label">Descripcion</label>
            <textarea className="input min-h-[100px]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div>
            <label className="label">Servicios</label>
            <textarea className="input min-h-[80px]" value={formData.services} onChange={(e) => setFormData({ ...formData, services: e.target.value })} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input min-h-[100px]" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {prospect.proposedWebUrl && <a className="text-primary-600 hover:underline break-all" href={prospect.proposedWebUrl} target="_blank" rel="noopener noreferrer">{prospect.proposedWebUrl}</a>}
          {prospect.description && <p className="text-slate-700">{prospect.description}</p>}
          {prospect.services && <p className="text-slate-700">{prospect.services}</p>}
          {prospect.notes && <p className="whitespace-pre-wrap text-slate-700">{prospect.notes}</p>}
          {!prospect.description && !prospect.services && !prospect.notes && (
            <p className="italic text-slate-400">No hay informacion de investigacion aun.</p>
          )}
        </div>
      )}
    </div>
  )
}
