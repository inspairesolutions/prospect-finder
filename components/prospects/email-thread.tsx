'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmailGenerator } from './email-generator'
import { EmailThread, EmailMessage } from '@/types'

interface EmailThreadPanelProps {
  prospectId: string
  prospectName: string
  prospectEmail?: string | null
  hasWebsite: boolean
  hasProposedUrl: boolean
}

export function EmailThreadPanel({
  prospectId,
  prospectName,
  prospectEmail,
  hasWebsite,
  hasProposedUrl,
}: EmailThreadPanelProps) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'list' | 'thread'>('list')
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyBcc, setReplyBcc] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)

  // ─── Compose new thread state ─────────────────────────────────────────────
  const [composeData, setComposeData] = useState({
    toEmail: prospectEmail ?? '',
    toName: '',
    bcc: '',
    subject: '',
    bodyHtml: '',
    proposalId: '',
  })

  // ─── Thread list query ────────────────────────────────────────────────────
  const { data: threads = [], isLoading } = useQuery<EmailThread[]>({
    queryKey: ['threads', prospectId],
    queryFn: async () => {
      const res = await axios.get(`/api/prospects/${prospectId}/threads`)
      return res.data
    },
  })

  // ─── Selected thread query ────────────────────────────────────────────────
  const { data: activeThread } = useQuery<EmailThread>({
    queryKey: ['thread', prospectId, selectedThreadId],
    queryFn: async () => {
      const res = await axios.get(
        `/api/prospects/${prospectId}/threads/${selectedThreadId}`
      )
      return res.data
    },
    enabled: !!selectedThreadId,
  })

  // ─── Create thread mutation ───────────────────────────────────────────────
  const { mutate: createThread, isPending: isCreating } = useMutation({
    mutationFn: async (data: typeof composeData) => {
      const res = await axios.post(`/api/prospects/${prospectId}/threads`, {
        toEmail: data.toEmail,
        toName: data.toName || undefined,
        bcc: data.bcc || undefined,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        proposalId: data.proposalId || undefined,
      })
      return res.data
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ['threads', prospectId] })
      queryClient.invalidateQueries({ queryKey: ['email-proposals', prospectId] })
      setShowCompose(false)
      setComposeData({ toEmail: prospectEmail ?? '', toName: '', bcc: '', subject: '', bodyHtml: '', proposalId: '' })
      setSelectedThreadId(thread.id)
      setView('thread')
      toast.success('Email enviado correctamente')
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'Error al enviar email')
    },
  })

  // ─── Mark as read ─────────────────────────────────────────────────────────
  const markRead = async (msgId: string) => {
    try {
      await axios.patch(
        `/api/prospects/${prospectId}/threads/${selectedThreadId}/messages/${msgId}`
      )
      queryClient.invalidateQueries({ queryKey: ['thread', prospectId, selectedThreadId] })
      queryClient.invalidateQueries({ queryKey: ['threads', prospectId] })
    } catch {
      // non-critical
    }
  }

  // ─── Send reply ──────────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyBody.trim() || !selectedThreadId) return
    setIsSendingReply(true)
    try {
      await axios.post(
        `/api/prospects/${prospectId}/threads/${selectedThreadId}/reply`,
        {
          bodyHtml: `<p>${replyBody.replace(/\n/g, '<br>')}</p>`,
          bcc: replyBcc || undefined,
        }
      )
      queryClient.invalidateQueries({ queryKey: ['thread', prospectId, selectedThreadId] })
      queryClient.invalidateQueries({ queryKey: ['threads', prospectId] })
      setReplyBody('')
      setReplyBcc('')
      toast.success('Respuesta enviada')
    } catch {
      toast.error('Error al enviar respuesta')
    } finally {
      setIsSendingReply(false)
    }
  }

  // ─── IMAP sync ────────────────────────────────────────────────────────────
  const syncIMAP = async () => {
    setIsSyncing(true)
    try {
      const res = await axios.post(`/api/prospects/${prospectId}/threads/check`)
      const count = res.data.newMessages as number
      queryClient.invalidateQueries({ queryKey: ['threads', prospectId] })
      if (selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ['thread', prospectId, selectedThreadId] })
      }
      toast.success(count > 0 ? `${count} nueva(s) respuesta(s)` : 'Sin nuevas respuestas')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
      const msg = axiosErr.response?.data?.error ?? axiosErr.message ?? 'Error desconocido'
      toast.error(msg, { duration: 8000 })
      console.error('syncIMAP error:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatRelative = (date: Date | string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 2) return 'ahora'
    if (minutes < 60) return `hace ${minutes}m`
    if (hours < 24) return `hace ${hours}h`
    if (days === 1) return 'ayer'
    return `hace ${days} días`
  }

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ─── Thread list view ─────────────────────────────────────────────────────
  const renderList = () => (
    <>
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <p className="text-sm text-slate-400 italic">
          Sin conversaciones. Envía el primer email para empezar.
        </p>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                setSelectedThreadId(thread.id)
                setView('thread')
              }}
              className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-primary-300 hover:bg-primary-50/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-slate-800 truncate">{thread.subject}</p>
                    {(thread.unreadCount ?? 0) > 0 && (
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-medium">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {thread.toEmail}
                    {thread.lastMessage && (
                      <> · {formatRelative(thread.lastMessage.createdAt)}</>
                    )}
                  </p>
                  {thread.lastMessage && (
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {thread.lastMessage.direction === 'inbound' ? '← ' : '→ '}
                      <span dangerouslySetInnerHTML={{
                        __html: thread.lastMessage.bodyHtml
                          .replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()
                          .slice(0, 80)
                      }} />
                    </p>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-slate-300 group-hover:text-primary-400 flex-shrink-0 mt-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )

  // ─── Thread detail view ───────────────────────────────────────────────────
  const renderThread = () => {
    const messages = activeThread?.messages ?? []

    return (
      <div className="space-y-4">
        {/* Back + subject */}
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <button
            onClick={() => { setView('list'); setReplyBody(''); setReplyBcc('') }}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-sm font-medium text-slate-800 truncate flex-1">
            {activeThread?.subject}
          </p>
        </div>

        {/* Messages */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400 italic">Cargando mensajes...</p>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onMarkRead={() => markRead(msg.id)}
              formatTime={formatTime}
            />
          ))}
        </div>

        {/* Reply box */}
        <div className="border border-slate-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-slate-500">Responder</p>
          <input
            type="text"
            className="w-full text-sm text-slate-800 border border-slate-200 rounded p-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            placeholder="CCO (opcional): email1@dominio.com, email2@dominio.com"
            value={replyBcc}
            onChange={(e) => setReplyBcc(e.target.value)}
          />
          <textarea
            className="w-full text-sm text-slate-800 border border-slate-200 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 min-h-[80px]"
            placeholder="Escribe tu respuesta..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={sendReply}
              isLoading={isSendingReply}
              disabled={!replyBody.trim()}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Enviar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Compose modal ─────────────────────────────────────────────────────────
  const renderComposeModal = () => (
    <Modal
      isOpen={showCompose}
      onClose={() => setShowCompose(false)}
      title="Nuevo email"
      size="lg"
    >
      <div className="space-y-4">
        {/* Use AI generator to fill content */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          Puedes generar el contenido del email con IA en la sección &quot;Email de primer contacto&quot; y luego enviarlo desde aquí, o redactar manualmente.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">
              Email destinatario *
              {prospectEmail && composeData.toEmail === prospectEmail && (
                <span className="ml-2 text-xs font-normal text-green-600">
                  (extraído del análisis web)
                </span>
              )}
            </label>
            <input
              type="email"
              className="input"
              value={composeData.toEmail}
              onChange={(e) => setComposeData({ ...composeData, toEmail: e.target.value })}
              placeholder="cliente@ejemplo.com"
            />
          </div>
          <div>
            <label className="label">CCO</label>
            <input
              type="text"
              className="input"
              value={composeData.bcc}
              onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
              placeholder="email1@dominio.com, email2@dominio.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nombre destinatario</label>
            <input
              type="text"
              className="input"
              value={composeData.toName}
              onChange={(e) => setComposeData({ ...composeData, toName: e.target.value })}
              placeholder="Nombre del contacto"
            />
          </div>
        </div>

        <div>
          <label className="label">Asunto *</label>
          <input
            type="text"
            className="input"
            value={composeData.subject}
            onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
            placeholder="Asunto del email"
          />
        </div>

        <div>
          <label className="label">Cuerpo del email *</label>
          <textarea
            className="input min-h-[200px] font-mono text-xs"
            value={composeData.bodyHtml}
            onChange={(e) => setComposeData({ ...composeData, bodyHtml: e.target.value })}
            placeholder="<p>Hola, te escribo para...</p>"
          />
          <p className="text-xs text-slate-400 mt-1">Acepta HTML. Puedes pegar el HTML generado por la IA.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setShowCompose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createThread(composeData)}
            isLoading={isCreating}
            disabled={!composeData.toEmail || !composeData.subject || !composeData.bodyHtml}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Enviar email
          </Button>
        </div>
      </div>
    </Modal>
  )

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Hilo de correo
            {threads.reduce((acc, t) => acc + (t.unreadCount ?? 0), 0) > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-medium">
                {threads.reduce((acc, t) => acc + (t.unreadCount ?? 0), 0)}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={syncIMAP}
                  isLoading={isSyncing}
                  title="Sincronizar respuestas"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {!isSyncing && <span className="ml-1 text-xs">Sincronizar</span>}
                </Button>
                <Button size="sm" onClick={() => setShowCompose(true)}>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo email
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {view === 'list' ? renderList() : renderThread()}
        </CardContent>
      </Card>

      {/* AI Generator card (always visible below thread panel) */}
      <EmailGenerator
        prospectId={prospectId}
        prospectName={prospectName}
        hasWebsite={hasWebsite}
        hasProposedUrl={hasProposedUrl}
        onSendProposal={(proposal) => {
          setComposeData({
            toEmail: prospectEmail ?? '',
            toName: '',
            bcc: '',
            subject: proposal.subject,
            bodyHtml: proposal.body,
            proposalId: proposal.id,
          })
          setShowCompose(true)
        }}
      />

      {renderComposeModal()}
    </>
  )
}

// ─── Message bubble sub-component ─────────────────────────────────────────────

function MessageBubble({
  message,
  onMarkRead,
  formatTime,
}: {
  message: EmailMessage
  onMarkRead: () => void
  formatTime: (d: Date | string) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const isInbound = message.direction === 'inbound'
  const isUnread = isInbound && !message.readAt

  // Mark as read on expand
  const handleExpand = () => {
    setExpanded((v) => !v)
    if (isUnread && !expanded) {
      onMarkRead()
    }
  }

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        isUnread
          ? 'border-orange-300 bg-orange-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Direction icon */}
          <span className={`flex-shrink-0 text-xs font-medium ${isInbound ? 'text-green-600' : 'text-primary-600'}`}>
            {isInbound ? '←' : '→'}
          </span>
          <span className="text-xs text-slate-600 truncate">
            {isInbound ? message.fromEmail : message.toEmail}
          </span>
          {isUnread && (
            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-medium">
              No leído
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400">{formatTime(message.createdAt)}</span>
          <svg
            className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-100">
          <div
            className="mt-2 text-sm text-slate-700 prose prose-sm max-w-none max-h-64 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        </div>
      )}

      {/* Collapsed preview */}
      {!expanded && (
        <div className="px-3 pb-2">
          <p className="text-xs text-slate-400 truncate">
            <span dangerouslySetInnerHTML={{
              __html: message.bodyHtml
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 100)
            }} />
          </p>
        </div>
      )}
    </div>
  )
}
