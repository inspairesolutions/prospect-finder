'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface LandingGeneratorProps {
  prospectId: string
  hasEnoughData: boolean
  embedded?: boolean
}

export function LandingGenerator({ prospectId, hasEnoughData, embedded = false }: LandingGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamedHtml, setStreamedHtml] = useState('')
  const [charCount, setCharCount] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const generate = async () => {
    setIsGenerating(true)
    setStreamedHtml('')
    setCharCount(0)
    setPublicUrl(null)
    setShowPreview(false)

    abortRef.current = new AbortController()

    try {
      const response = await fetch(`/api/prospects/${prospectId}/generate-landing`, {
        method: 'POST',
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(err.error ?? 'Error al generar la landing')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setCharCount(fullText.length)

        // Extract metadata if present at the end
        const metaMatch = fullText.match(/<!--META:({.*?})-->$/)
        if (metaMatch) {
          try {
            const meta = JSON.parse(metaMatch[1])
            setPublicUrl(meta.publicUrl)
          } catch { /* ignore */ }
          // Don't show META comment in preview
          setStreamedHtml(fullText.replace(/\n<!--META:{.*?}-->$/, ''))
        } else {
          setStreamedHtml(fullText)
        }
      }

      if (fullText.toLowerCase().includes('error:')) {
        toast.error('La generación tuvo errores. Revisa el contenido.')
      } else {
        toast.success('Landing generada y publicada')
        setShowPreview(true)
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') {
        toast('Generación cancelada', { icon: '⏹' })
      } else {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        toast.error(msg)
      }
    } finally {
      setIsGenerating(false)
      abortRef.current = null
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  const isDone = !isGenerating && streamedHtml.length > 0

  const body = (
    <div className="space-y-4">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {publicUrl ? (
            <>
              Publicada en{' '}
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-800 font-medium underline-offset-2 hover:underline"
              >
                ver landing
              </a>
            </>
          ) : (
            'HTML autocontenido via Anthropic API'
          )}
        </p>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Cancelar
            </Button>
          )}
          {!isGenerating && (
            <Button
              variant="primary"
              size="sm"
              onClick={generate}
              disabled={!hasEnoughData}
              title={!hasEnoughData ? 'Añade descripción y servicios del negocio antes de generar' : ''}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {isDone ? 'Regenerar' : 'Generar Landing'}
            </Button>
          )}
        </div>
      </div>

      <div>
        {!hasEnoughData && !streamedHtml && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Datos insuficientes</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Rellena primero en <strong>Investigación</strong>: descripción del negocio y servicios.
              </p>
            </div>
          </div>
        )}

        {!isGenerating && !streamedHtml && hasEnoughData && (
          <p className="text-sm text-slate-400 italic">
            Haz clic en &quot;Generar Landing&quot; para crear la web con la API de Anthropic directamente. Sin Claude Code.
          </p>
        )}

        {/* Generation progress + preview */}
        {(isGenerating || streamedHtml) && (
          <div className="space-y-3">
            {/* Stats bar */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                {isGenerating && (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Generando HTML con Claude...
                  </span>
                )}
                {charCount > 0 && (
                  <span className="font-medium text-slate-600">
                    {(charCount / 1024).toFixed(1)} KB
                  </span>
                )}
                {isDone && publicUrl && (
                  <span className="text-emerald-600 font-medium">Publicada</span>
                )}
              </div>
              {streamedHtml && (
                <button
                  onClick={() => setShowPreview((v) => !v)}
                  className="text-emerald-600 hover:text-emerald-800 font-medium"
                >
                  {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
                </button>
              )}
            </div>

            {/* Progress bar */}
            {isGenerating && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min((charCount / 50000) * 100, 95)}%` }}
                />
              </div>
            )}

            {/* Live HTML preview in iframe */}
            {showPreview && streamedHtml && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Vista previa</span>
                  {publicUrl && (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                      Abrir en nueva pestaña
                    </a>
                  )}
                </div>
                <iframe
                  srcDoc={streamedHtml}
                  className="w-full h-[500px] border-0"
                  sandbox="allow-scripts"
                  title="Landing preview"
                />
              </div>
            )}

            {/* Source code toggle */}
            {isDone && !showPreview && (
              <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <pre className="text-xs text-slate-700 p-4 whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto max-h-32">
                  {streamedHtml.slice(0, 300)}
                  {streamedHtml.length > 300 && <span className="text-slate-400">...</span>}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return embedded ? body : <div>{body}</div>
}
