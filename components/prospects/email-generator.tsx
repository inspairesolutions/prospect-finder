'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/utils'
import { EmailProposal, GeneratedEmailResult, GeneratedEmailVariant } from '@/types'

interface EmailGeneratorProps {
  prospectId: string
  prospectName: string
  hasWebsite: boolean
  hasProposedUrl: boolean
  onSendProposal?: (proposal: EmailProposal) => void
}

export function EmailGenerator({ prospectId, prospectName, hasWebsite, hasProposedUrl, onSendProposal }: EmailGeneratorProps) {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [generated, setGenerated] = useState<GeneratedEmailResult | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [showPreview, setShowPreview] = useState<string | null>(null) // emailId for full preview

  // Load saved proposals
  const { data: proposals = [] } = useQuery<EmailProposal[]>({
    queryKey: ['email-proposals', prospectId],
    queryFn: async () => {
      const res = await axios.get(`/api/prospects/${prospectId}/email`)
      return res.data
    },
  })

  // Generate email via Claude
  const { mutate: generate, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      const res = await axios.post(`/api/prospects/${prospectId}/email`)
      return res.data as GeneratedEmailResult
    },
    onSuccess: (data) => {
      setGenerated(data)
      setActiveTab(0)
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Error al generar email')
    },
  })

  // Save a generated variant
  const { mutate: saveProposal, isPending: isSaving } = useMutation({
    mutationFn: async (variant: GeneratedEmailVariant) => {
      const res = await axios.put(`/api/prospects/${prospectId}/email`, {
        subject: variant.subject,
        body: variant.body,
        variant: variant.id,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-proposals', prospectId] })
      toast.success('Propuesta guardada')
    },
    onError: () => {
      toast.error('Error al guardar propuesta')
    },
  })

  // Delete a proposal
  const { mutate: deleteProposal } = useMutation({
    mutationFn: async (emailId: string) => {
      await axios.delete(`/api/prospects/${prospectId}/email/${emailId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-proposals', prospectId] })
      toast.success('Propuesta eliminada')
    },
    onError: () => {
      toast.error('Error al eliminar propuesta')
    },
  })

  // Mark as sent
  const { mutate: markSent } = useMutation({
    mutationFn: async (emailId: string) => {
      await axios.patch(`/api/prospects/${prospectId}/email/${emailId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-proposals', prospectId] })
      toast.success('Marcado como enviado')
    },
  })

  const handleOpen = () => {
    setGenerated(null)
    setShowModal(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado al portapapeles')
  }

  const variantLabel = (id: string) =>
    id === 'direct' ? 'Directo' : 'Consultivo'

  return (
    <>
      {/* Card section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email de primer contacto
          </h3>
          <Button size="sm" onClick={handleOpen}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generar con IA
          </Button>
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              No hay propuestas guardadas aún. Genera un email con IA para empezar.
            </p>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.variant === 'direct'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-violet-50 text-violet-700'
                        }`}>
                          {variantLabel(p.variant)}
                        </span>
                        {p.sentAt && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                            Enviado
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">{p.subject}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setShowPreview(p.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                        title="Ver email"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => copyToClipboard(p.body)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                        title="Copiar HTML"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {!p.sentAt && onSendProposal && (
                        <button
                          onClick={() => onSendProposal(p)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                          title="Enviar por email"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      )}
                      {!p.sentAt && !onSendProposal && (
                        <button
                          onClick={() => markSent(p.id)}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Marcar como enviado"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => deleteProposal(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generator Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Generar email de primer contacto"
        size="lg"
      >
        <div className="space-y-5">
          {/* Context summary */}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-medium text-slate-700">{prospectName}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className={`flex items-center gap-1 ${hasWebsite ? 'text-amber-600' : 'text-blue-600'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                {hasWebsite ? 'Tiene web actual → email de renovación' : 'Sin web → email de nueva web'}
              </span>
              <span className={`flex items-center gap-1 ${hasProposedUrl ? 'text-green-600' : 'text-red-500'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {hasProposedUrl ? 'URL propuesta configurada' : 'Sin URL propuesta (añádela en Investigación)'}
              </span>
            </div>
          </div>

          {/* Generate button */}
          {!generated && (
            <div className="text-center py-4">
              <Button onClick={() => generate()} isLoading={isGenerating} size="lg">
                {isGenerating ? (
                  <>Generando con Claude...</>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generar 2 variantes de email
                  </>
                )}
              </Button>
              {isGenerating && (
                <p className="text-xs text-slate-400 mt-2">Claude está analizando el prospecto y redactando...</p>
              )}
            </div>
          )}

          {/* Generated variants */}
          {generated && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-200">
                {generated.variants.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveTab(i)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === i
                        ? 'border-primary-500 text-primary-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>

              {/* Active variant */}
              {generated.variants[activeTab] && (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <span className="text-xs text-slate-500 font-medium">Subject: </span>
                    <span className="text-sm text-slate-900">{generated.variants[activeTab].subject}</span>
                  </div>
                  <div
                    className="text-sm text-slate-700 border border-slate-200 rounded-lg p-4 prose prose-sm max-w-none max-h-64 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: generated.variants[activeTab].body }}
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => copyToClipboard(generated.variants[activeTab].body)}
                      className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copiar HTML
                    </button>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => generate()} isLoading={isGenerating}>
                        Regenerar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => saveProposal(generated.variants[activeTab])}
                        isLoading={isSaving}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Guardar
                      </Button>
                      {onSendProposal && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            // Save first, then trigger send
                            const res = await import('axios').then((m) =>
                              m.default.put(`/api/prospects/${prospectId}/email`, {
                                subject: generated.variants[activeTab].subject,
                                body: generated.variants[activeTab].body,
                                variant: generated.variants[activeTab].id,
                              })
                            )
                            const saved = res.data as import('@/types').EmailProposal
                            onSendProposal(saved)
                            setShowModal(false)
                          }}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Enviar email
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Email preview modal */}
      {showPreview && (
        <Modal
          isOpen={!!showPreview}
          onClose={() => setShowPreview(null)}
          title="Vista previa del email"
          size="lg"
        >
          {(() => {
            const p = proposals.find((x) => x.id === showPreview)
            if (!p) return null
            return (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded px-3 py-2">
                  <span className="text-xs text-slate-500 font-medium">Subject: </span>
                  <span className="text-sm text-slate-900">{p.subject}</span>
                </div>
                <div
                  className="text-sm text-slate-700 border border-slate-200 rounded-lg p-4 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: p.body }}
                />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-400">
                    Guardado: {formatDate(p.createdAt)}
                    {p.sentAt && ` · Enviado: ${formatDate(p.sentAt)}`}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(p.body)}>
                    Copiar HTML
                  </Button>
                </div>
              </div>
            )
          })()}
        </Modal>
      )}
    </>
  )
}
