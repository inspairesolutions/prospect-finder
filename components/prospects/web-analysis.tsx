'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface WebAnalysisProps {
  prospectId: string
  website: string | null
  embedded?: boolean
}

interface AnalysisJobInfo {
  status: 'PENDING' | 'RUNNING' | 'FAILED'
  step: string | null
  jobId: string
  error?: string | null
}

interface AnalysisResponse {
  hasAnalysis: boolean
  hasWebsite: boolean
  analysis?: WebAnalysis
  score?: number
  category?: string
  analyzedAt?: string
  job?: AnalysisJobInfo | null
  screenshots?: Record<string, string> | null
}

interface ApiErrorPayload {
  error?: string
  details?: string
}

interface WebAnalysis {
  url: string
  timestamp: string
  status: string
  technology: {
    cms: string | null
    cms_version: string | null
    page_builder: string | null
    frameworks: string[]
    libraries: string[]
    analytics: string[]
  }
  design: {
    estimated_age: string
    estimated_year: number | null
    design_quality: string
    is_outdated: boolean
    age_score: number
    issues: string[]
    recommendations: string[]
  }
  performance: {
    load_time: number
    load_time_rating: string
    page_size: number
    page_size_rating: string
    issues: string[]
    recommendations: string[]
  }
  responsive: {
    is_mobile_friendly: boolean
    has_viewport_meta: boolean
    score: number
    issues: string[]
    recommendations: string[]
  }
  seo: {
    score: number
    has_title: boolean
    title: string | null
    has_meta_description: boolean
    meta_description: string | null
    issues: string[]
    recommendations: string[]
  }
  content: {
    emails: string[]
    phones: string[]
    address: string | null
    social_media: Record<string, string>
    estimated_pages: number
    word_count: number
    has_blog: boolean
    has_shop: boolean
  }
  technical: {
    ssl: {
      has_ssl: boolean
      is_valid: boolean
    }
    broken_links_count: number
    accessibility_issues: string[]
    missing_security_headers: string[]
    issues: string[]
    severity: string
  }
  business: {
    industry: string | null
    business_type: string | null
    is_local_business: boolean
    professionalism_score: number
    opportunity_factors: string[]
  }
  scoring: {
    total_score: number
    category: string
    recommendation: string
    positive_factors: string[]
    negative_factors: string[]
    breakdown: Record<string, { points: number; reasons: string[] }>
  }
}

const categoryColors: Record<string, string> = {
  PRIORIDAD_MAXIMA: 'bg-red-100 text-red-700 border-red-200',
  CONTACTAR: 'bg-orange-100 text-orange-700 border-orange-200',
  EVALUAR: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  RECHAZAR: 'bg-slate-100 text-slate-600 border-slate-200',
}

const categoryLabels: Record<string, string> = {
  PRIORIDAD_MAXIMA: 'Prioridad Máxima',
  CONTACTAR: 'Contactar',
  EVALUAR: 'Evaluar',
  RECHAZAR: 'Baja Prioridad',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function ScoreCircle({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const getColor = (s: number) => {
    if (s >= 70) return 'text-red-500'
    if (s >= 50) return 'text-orange-500'
    if (s >= 30) return 'text-yellow-500'
    return 'text-green-500'
  }

  const sizeClasses = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-12 h-12 text-lg'

  return (
    <div className={`${sizeClasses} rounded-full border-4 ${getColor(score)} border-current flex items-center justify-center font-bold`}>
      {score}
    </div>
  )
}

function AnalysisSection({ title, children, icon }: { title: string; children: React.ReactNode; icon: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-slate-700">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-4 border-t border-slate-200">{children}</div>}
    </div>
  )
}

function IssuesList({ issues, type }: { issues: string[]; type: 'issue' | 'recommendation' }) {
  if (!issues || issues.length === 0) return null

  return (
    <ul className="space-y-1 mt-2">
      {issues.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {type === 'issue' ? (
            <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="text-slate-600">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function WebAnalysis({ prospectId, website, embedded = false }: WebAnalysisProps) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['web-analysis', prospectId],
    queryFn: async () => {
      const response = await axios.get<AnalysisResponse>(`/api/prospects/${prospectId}/analyze`)
      return response.data
    },
    refetchInterval: (query) => {
      const job = query.state.data?.job
      if (job && (job.status === 'PENDING' || job.status === 'RUNNING')) return 3000
      return false
    },
  })

  const isAnalysisInProgress = data?.job?.status === 'PENDING' || data?.job?.status === 'RUNNING'

  // When analysis completes (job disappears and analysis appears), refresh prospect data
  useEffect(() => {
    if (!data?.job && data?.hasAnalysis) {
      queryClient.invalidateQueries({ queryKey: ['prospect', prospectId] })
    }
  }, [data?.job, data?.hasAnalysis, prospectId, queryClient])

  const { mutate: runAnalysis, isPending: isAnalyzing } = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/prospects/${prospectId}/analyze`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-analysis', prospectId] })
      toast.success('Análisis iniciado')
    },
    onError: (error: { response?: { data?: ApiErrorPayload } }) => {
      const apiError = error.response?.data?.error || 'Error al analizar el sitio web'
      const details = error.response?.data?.details?.trim()
      const message = details ? `${apiError}: ${details}` : apiError
      toast.error(message)
    },
  })

  const { mutate: deleteAnalysis, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/prospects/${prospectId}/analyze`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-analysis', prospectId] })
      toast.success('Análisis eliminado')
    },
    onError: () => {
      toast.error('Error al eliminar el análisis')
    },
  })

  const panelHeader = (subtitle: React.ReactNode, actions?: React.ReactNode) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="text-sm text-slate-500">{subtitle}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </div>
  )

  if (!website) {
    const body = (
      <div className="space-y-4">
        {panelHeader('Sin sitio web registrado')}
        <p className="text-sm text-slate-500">Este prospecto no tiene sitio web registrado.</p>
      </div>
    )
    return embedded ? body : <div>{body}</div>
  }

  if (isLoading) {
    const body = (
      <div className="space-y-4">
        {panelHeader('Cargando analisis web...')}
        <div className="animate-pulse space-y-3"><div className="h-20 bg-slate-100 rounded" /><div className="h-4 bg-slate-100 rounded w-2/3" /><div className="h-4 bg-slate-100 rounded w-1/2" /></div>
      </div>
    )
    return embedded ? body : <div>{body}</div>
  }

  if (isAnalysisInProgress) {
    const stepLabels: Record<string, string> = {
      fetching: 'Descargando sitio web...',
      capturing_screenshots: 'Capturando screenshots...',
      analyzing_technology: 'Analizando tecnología...',
      analyzing_design: 'Analizando diseño...',
      analyzing_performance: 'Midiendo rendimiento...',
      analyzing_responsive: 'Verificando responsive...',
      analyzing_seo: 'Analizando SEO...',
      analyzing_content: 'Extrayendo contenido...',
      analyzing_technical: 'Revisión técnica...',
      analyzing_business: 'Analizando negocio...',
      calculating_score: 'Calculando puntuación...',
      uploading_screenshots: 'Subiendo capturas...',
    }
    const stepText = data?.job?.step ? (stepLabels[data.job.step] || data.job.step) : (data?.job?.status === 'PENDING' ? 'En cola...' : 'Procesando...')

    return (
      <div className="space-y-4">
        {panelHeader('Análisis en curso')}
        <div className="text-center py-8">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-medium text-slate-700">{stepText}</p>
            <p className="text-xs text-slate-400">Esto puede tomar hasta 2 minutos</p>
          </div>
        </div>
      </div>
    )
  }

  if (data?.job?.status === 'FAILED' && !data?.hasAnalysis) return (
    <div className="space-y-4">
      {panelHeader(
        'El análisis automático falló',
        <Button variant="primary" size="sm" onClick={() => runAnalysis()} isLoading={isAnalyzing}>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Reintentar análisis
        </Button>
      )}
      <div className="text-center py-6">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600">El análisis automático falló</p>
          {data.job.error && <p className="text-xs text-slate-500">{data.job.error}</p>}
        </div>
      </div>
    </div>
  )

  if (!data?.hasAnalysis) return (
    <div className="space-y-4">
      {panelHeader(
        'Sin analisis aun',
        <Button variant="primary" size="sm" onClick={() => runAnalysis()} isLoading={isAnalyzing}>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Analizar sitio web
        </Button>
      )}
      <div className="text-center py-6">
      <p className="text-sm text-slate-600 mb-4">Analiza el sitio web de este prospecto para identificar oportunidades.</p>
    </div>
    </div>
  )

  const analysis = data.analysis!
  const { scoring } = analysis

  const body = (
      <div className="space-y-6">
        {panelHeader(
          `Auditoria del sitio actual (score ${scoring.total_score}/100)`,
          <>
            <Button
              variant="ghost"
              size="sm"
              icon
              title="Eliminar analisis"
              onClick={() => deleteAnalysis()}
              isLoading={isDeleting}
              disabled={isAnalysisInProgress}
            >
              <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => runAnalysis()}
              isLoading={isAnalyzing}
              disabled={isAnalysisInProgress}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Reanalizar
            </Button>
          </>
        )}
        {/* Score Overview */}
        <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-lg">
          <ScoreCircle score={scoring.total_score} />
          <div className="flex-1">
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${categoryColors[scoring.category] || 'bg-slate-100'}`}>
              {categoryLabels[scoring.category] || scoring.category}
            </div>
            <p className="text-sm text-slate-600 mt-2">{scoring.recommendation}</p>
            <p className="text-xs text-slate-400 mt-2">
              Analizado: {data.analyzedAt ? formatDate(data.analyzedAt) : 'Desconocido'}
            </p>
          </div>
        </div>

        {/* Screenshots */}
        {data.screenshots && Object.keys(data.screenshots).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Capturas del sitio</h4>
            <div className="grid grid-cols-3 gap-3">
              {data.screenshots.desktop_viewport && (
                <a href={data.screenshots.desktop_viewport} target="_blank" rel="noopener noreferrer" className="group block">
                  <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group-hover:border-blue-400 transition-colors">
                    <img src={data.screenshots.desktop_viewport} alt="Desktop viewport" className="w-full h-full object-cover object-top" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-center">Desktop</p>
                </a>
              )}
              {data.screenshots.desktop_full && (
                <a href={data.screenshots.desktop_full} target="_blank" rel="noopener noreferrer" className="group block">
                  <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group-hover:border-blue-400 transition-colors">
                    <img src={data.screenshots.desktop_full} alt="Desktop full page" className="w-full h-full object-cover object-top" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-center">Página completa</p>
                </a>
              )}
              {data.screenshots.mobile_full && (
                <a href={data.screenshots.mobile_full} target="_blank" rel="noopener noreferrer" className="group block">
                  <div className="aspect-[9/16] max-h-32 mx-auto bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group-hover:border-blue-400 transition-colors">
                    <img src={data.screenshots.mobile_full} alt="Mobile full page" className="w-full h-full object-cover object-top" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-center">Móvil</p>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Positive/Negative Factors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Factores positivos
            </h4>
            <ul className="space-y-1">
              {scoring.positive_factors.map((factor, i) => (
                <li key={i} className="text-xs text-green-700">+ {factor}</li>
              ))}
            </ul>
          </div>
          <div className="p-3 bg-red-50 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Factores negativos
            </h4>
            <ul className="space-y-1">
              {scoring.negative_factors.length > 0 ? (
                scoring.negative_factors.map((factor, i) => (
                  <li key={i} className="text-xs text-red-700">- {factor}</li>
                ))
              ) : (
                <li className="text-xs text-slate-400 italic">Ninguno</li>
              )}
            </ul>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-2">
          {/* Technology */}
          <AnalysisSection
            title="Tecnología"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">CMS:</span>
                <span className="ml-2 font-medium text-slate-900">{analysis.technology.cms || 'No detectado'}</span>
                {analysis.technology.cms_version && <span className="text-slate-600 text-xs ml-1">v{analysis.technology.cms_version}</span>}
              </div>
              <div>
                <span className="text-slate-500">Page Builder:</span>
                <span className="ml-2 font-medium text-slate-900">{analysis.technology.page_builder || 'Ninguno'}</span>
              </div>
              {analysis.technology.frameworks.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-500">Frameworks:</span>
                  <span className="ml-2 text-slate-900">{analysis.technology.frameworks.join(', ')}</span>
                </div>
              )}
              {analysis.technology.libraries.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-500">Librerías:</span>
                  <span className="ml-2 text-slate-900">{analysis.technology.libraries.join(', ')}</span>
                </div>
              )}
              {analysis.technology.analytics.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-500">Analytics:</span>
                  <span className="ml-2 text-slate-900">{analysis.technology.analytics.join(', ')}</span>
                </div>
              )}
            </div>
          </AnalysisSection>

          {/* Design */}
          <AnalysisSection
            title="Diseño"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Antigüedad:</span>
                <span className="ml-2 font-medium text-slate-900 capitalize">{analysis.design.estimated_age}</span>
                {analysis.design.estimated_year && <span className="text-slate-600 text-xs ml-1">(~{analysis.design.estimated_year})</span>}
              </div>
              <div>
                <span className="text-slate-500">Calidad:</span>
                <span className="ml-2 font-medium text-slate-900 capitalize">{analysis.design.design_quality}</span>
              </div>
              <div className="col-span-2">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${analysis.design.is_outdated ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {analysis.design.is_outdated ? 'Diseño anticuado' : 'Diseño actualizado'}
                </span>
              </div>
            </div>
            <IssuesList issues={analysis.design.issues} type="issue" />
            <IssuesList issues={analysis.design.recommendations} type="recommendation" />
          </AnalysisSection>

          {/* Performance */}
          <AnalysisSection
            title="Rendimiento"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          >
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-slate-50 rounded">
                <p className="text-lg font-bold text-slate-900">{analysis.performance.load_time.toFixed(2)}s</p>
                <p className="text-xs text-slate-500">Tiempo de carga</p>
                <span className={`text-xs px-2 py-0.5 rounded ${analysis.performance.load_time_rating === 'good' ? 'bg-green-100 text-green-700' : analysis.performance.load_time_rating === 'moderate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {analysis.performance.load_time_rating}
                </span>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded">
                <p className="text-lg font-bold text-slate-900">{formatBytes(analysis.performance.page_size)}</p>
                <p className="text-xs text-slate-500">Tamaño de página</p>
                <span className={`text-xs px-2 py-0.5 rounded ${analysis.performance.page_size_rating === 'good' ? 'bg-green-100 text-green-700' : analysis.performance.page_size_rating === 'moderate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {analysis.performance.page_size_rating}
                </span>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded">
                <p className="text-lg font-bold text-slate-900">{analysis.responsive.score}</p>
                <p className="text-xs text-slate-500">Score responsive</p>
                <span className={`text-xs px-2 py-0.5 rounded ${analysis.responsive.is_mobile_friendly ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {analysis.responsive.is_mobile_friendly ? 'Mobile-friendly' : 'No mobile'}
                </span>
              </div>
            </div>
            <IssuesList issues={analysis.performance.issues} type="issue" />
            <IssuesList issues={analysis.performance.recommendations} type="recommendation" />
          </AnalysisSection>

          {/* SEO */}
          <AnalysisSection
            title={`SEO (${analysis.seo.score}/100)`}
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
          >
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Título:</span>
                <span className={`ml-2 ${analysis.seo.has_title ? 'text-green-600' : 'text-red-600'}`}>
                  {analysis.seo.title || 'No tiene'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Meta descripción:</span>
                <span className={`ml-2 ${analysis.seo.has_meta_description ? 'text-green-600' : 'text-red-600'}`}>
                  {analysis.seo.has_meta_description ? 'Presente' : 'No tiene'}
                </span>
              </div>
            </div>
            <IssuesList issues={analysis.seo.issues} type="issue" />
            <IssuesList issues={analysis.seo.recommendations} type="recommendation" />
          </AnalysisSection>

          {/* Technical */}
          <AnalysisSection
            title="Técnico"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {analysis.technical.ssl.has_ssl ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                <span className="text-slate-900">{analysis.technical.ssl.has_ssl ? 'HTTPS activo' : 'Sin HTTPS'}</span>
              </div>
              <div>
                <span className="text-slate-500">Severidad:</span>
                <span className={`ml-2 capitalize ${analysis.technical.severity === 'low' ? 'text-green-600' : analysis.technical.severity === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analysis.technical.severity}
                </span>
              </div>
            </div>
            {analysis.technical.missing_security_headers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Headers de seguridad faltantes:</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.technical.missing_security_headers.map((header, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded">{header}</span>
                  ))}
                </div>
              </div>
            )}
            <IssuesList issues={analysis.technical.issues} type="issue" />
            <IssuesList issues={analysis.technical.accessibility_issues} type="issue" />
          </AnalysisSection>

          {/* Content */}
          <AnalysisSection
            title="Contenido"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Páginas estimadas:</span>
                <span className="ml-2 font-medium text-slate-900">{analysis.content.estimated_pages}</span>
              </div>
              <div>
                <span className="text-slate-500">Palabras:</span>
                <span className="ml-2 font-medium text-slate-900">{analysis.content.word_count}</span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.content.has_blog ? (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Tiene blog</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded">Sin blog</span>
                )}
                {analysis.content.has_shop ? (
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Tiene tienda</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-slate-100 text-slate-500 rounded">Sin tienda</span>
                )}
              </div>
            </div>
            {analysis.content.emails.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500">Emails encontrados:</p>
                <p className="text-sm text-slate-900">{analysis.content.emails.join(', ')}</p>
              </div>
            )}
            {Object.keys(analysis.content.social_media).length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Redes sociales:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(analysis.content.social_media).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 capitalize"
                    >
                      {platform}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </AnalysisSection>

          {/* Business */}
          <AnalysisSection
            title="Negocio"
            icon={<svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          >
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Industria:</span>
                <span className="ml-2 font-medium text-slate-900 capitalize">{analysis.business.industry || 'No detectada'}</span>
              </div>
              <div>
                <span className="text-slate-500">Tipo:</span>
                <span className="ml-2 font-medium text-slate-900 capitalize">{analysis.business.business_type || 'Desconocido'}</span>
              </div>
              <div>
                <span className="text-slate-500">Profesionalismo:</span>
                <span className="ml-2 font-medium text-slate-900">{analysis.business.professionalism_score}/100</span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.business.is_local_business && (
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Negocio local</span>
                )}
              </div>
            </div>
            {analysis.business.opportunity_factors.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 rounded">
                <p className="text-xs font-medium text-amber-800 mb-1">Factores de oportunidad:</p>
                <ul className="space-y-1">
                  {analysis.business.opportunity_factors.map((factor, i) => (
                    <li key={i} className="text-xs text-amber-700">• {factor}</li>
                  ))}
                </ul>
              </div>
            )}
          </AnalysisSection>
        </div>
      </div>
  )

  return embedded ? body : <div>{body}</div>
}
