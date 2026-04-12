'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface SiteGeneratorProps {
  prospectId: string
  hasEnoughData: boolean
}

export function SiteGenerator({ prospectId, hasEnoughData }: SiteGeneratorProps) {
  const [buildLog, setBuildLog] = useState('')
  const [buildStatus, setBuildStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [showBuildLog, setShowBuildLog] = useState(false)
  const [buildElapsed, setBuildElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevLogLenRef = useRef(0)

  // Check if site already exists
  const { data: siteInfo, refetch: refetchSite } = useQuery<{
    exists: boolean
    slug: string
    path: string | null
    publicUrl: string | null
    files: string[]
    fileCount?: number
  }>({
    queryKey: ['site-info', prospectId],
    queryFn: async () => {
      const res = await axios.get(`/api/prospects/${prospectId}/generate-site`)
      return res.data
    },
  })

  // Poll for build status from server
  const pollBuildStatus = useCallback(async () => {
    try {
      const res = await axios.get(`/api/prospects/${prospectId}/generate-site?poll=true`)
      const data = res.data as { status: string; log: string; slug?: string; elapsed?: number }

      if (data.status === 'idle' && buildStatus === 'idle') return

      setBuildLog(data.log || '')
      setBuildElapsed(data.elapsed || 0)

      if (data.status === 'running') {
        setBuildStatus('running')
        setShowBuildLog(true)
      } else if (data.status === 'done') {
        setBuildStatus('done')
        stopPolling()
        if (prevLogLenRef.current > 0 && data.log.length > prevLogLenRef.current) {
          toast.success('Sitio generado correctamente')
        }
        refetchSite()
      } else if (data.status === 'error') {
        setBuildStatus('error')
        stopPolling()
        if (prevLogLenRef.current > 0) {
          toast.error('Error al generar el sitio')
        }
      }

      prevLogLenRef.current = (data.log || '').length
    } catch {
      // ignore poll errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId, buildStatus, refetchSite])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(pollBuildStatus, 2000)
    pollBuildStatus()
  }, [pollBuildStatus])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mount: check if there's an active build (reconnect scenario)
  useEffect(() => {
    const checkActiveBuild = async () => {
      try {
        const res = await axios.get(`/api/prospects/${prospectId}/generate-site?poll=true`)
        if (res.data.status === 'running') {
          setBuildStatus('running')
          setBuildLog(res.data.log || '')
          setBuildElapsed(res.data.elapsed || 0)
          setShowBuildLog(true)
          prevLogLenRef.current = (res.data.log || '').length
          startPolling()
        }
      } catch {
        // ignore
      }
    }
    checkActiveBuild()
    return () => stopPolling()
  }, [prospectId, startPolling, stopPolling])

  // Launch build
  const buildSite = async () => {
    setBuildLog('')
    setBuildStatus('running')
    setShowBuildLog(true)
    prevLogLenRef.current = 0

    try {
      const response = await axios.post(`/api/prospects/${prospectId}/generate-site`)

      if (response.data.error) {
        throw new Error(response.data.error)
      }

      startPolling()
    } catch (err: unknown) {
      setBuildStatus('error')
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast.error(msg)
    }
  }

  const cancelBuild = async () => {
    try {
      await axios.delete(`/api/prospects/${prospectId}/generate-site`)
      stopPolling()
      setBuildStatus('idle')
      toast('Build cancelado', { icon: '⏹' })
    } catch {
      toast.error('Error al cancelar')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Generador de Landing Page
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {siteInfo?.exists && siteInfo.publicUrl ? (
              <>
                Disponible en{' '}
                <a
                  href={siteInfo.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 font-medium underline-offset-2 hover:underline"
                >
                  {siteInfo.publicUrl}
                </a>
                <span className="text-slate-400">
                  {' '}
                  · {(siteInfo.fileCount ?? siteInfo.files.length) || 0} archivo
                  {(siteInfo.fileCount ?? siteInfo.files.length) === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              `Genera la landing page directamente con Claude Code`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {buildStatus === 'running' && (
            <Button variant="ghost" size="sm" onClick={cancelBuild}>
              <svg className="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancelar
            </Button>
          )}
          {buildStatus !== 'running' && (
            <Button
              size="sm"
              variant={siteInfo?.exists ? 'secondary' : 'primary'}
              onClick={buildSite}
              disabled={!hasEnoughData}
              title={!hasEnoughData ? 'Añade descripción y servicios del negocio antes de generar' : ''}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {siteInfo?.exists ? 'Regenerar Landing' : 'Generar Landing Page'}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!hasEnoughData && buildStatus === 'idle' && !siteInfo?.exists && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Datos insuficientes</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Para generar una landing de calidad, rellena primero en <strong>Investigación</strong>: descripción del negocio, servicios y propuesta de valor.
              </p>
            </div>
          </div>
        )}

        {buildStatus === 'idle' && hasEnoughData && !siteInfo?.exists && (
          <p className="text-sm text-slate-400 italic">
            Haz clic en &quot;Generar Landing Page&quot; para crear la web del negocio directamente.
          </p>
        )}

        {/* Build progress */}
        {(buildStatus !== 'idle' || buildLog) && (
          <div className="space-y-2">
            {buildStatus === 'running' && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Claude Code está construyendo la web...
                {buildElapsed > 0 && (
                  <span className="text-slate-400 ml-1">
                    ({Math.floor(buildElapsed / 60)}:{String(buildElapsed % 60).padStart(2, '0')})
                  </span>
                )}
              </div>
            )}

            {buildStatus === 'done' && (
              <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sitio generado correctamente
              </div>
            )}

            {buildStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs text-red-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Error al generar el sitio
              </div>
            )}

            {buildLog && (
              <div>
                <button
                  onClick={() => setShowBuildLog((v) => !v)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium mb-1"
                >
                  {showBuildLog ? 'Ocultar log' : 'Ver log de Claude Code'}
                </button>
                {showBuildLog && (
                  <div className="border border-slate-200 rounded-lg bg-slate-900 overflow-hidden">
                    <pre className="text-xs text-green-400 p-4 whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto max-h-[400px]">
                      {buildLog}
                      {buildStatus === 'running' && (
                        <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 animate-pulse" />
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
