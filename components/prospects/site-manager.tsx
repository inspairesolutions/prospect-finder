'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import toast from 'react-hot-toast'
import type { ProspectSite } from '@/types'

interface SiteManagerProps {
  prospectId: string
  favoriteUrl?: string | null
  onSelectFavorite: (url: string) => void
}

export function SiteManager({ prospectId, favoriteUrl, onSelectFavorite }: SiteManagerProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [label, setLabel] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fromStitch, setFromStitch] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProspectSite | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: sites = [], isLoading } = useQuery<ProspectSite[]>({
    queryKey: ['prospect-sites', prospectId],
    queryFn: async () => {
      const res = await axios.get(`/api/prospects/${prospectId}/sites`)
      return res.data
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.zip')) {
      toast.error('Solo se aceptan archivos .zip')
      return
    }

    setSelectedFile(file)
    // Auto-suggest label from filename
    const suggestedLabel = file.name
      .replace(/\.zip$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    setLabel(suggestedLabel)
    setShowUploadModal(true)

    // Reset input so re-selecting same file works
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress('Subiendo archivo...')

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('label', label || 'Sitio subido')
    if (fromStitch) formData.append('fromStitch', 'true')

    try {
      setUploadProgress(fromStitch ? 'Convirtiendo desde Stitch...' : 'Descomprimiendo...')
      await axios.post(`/api/prospects/${prospectId}/sites`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success('Landing subida correctamente')
      queryClient.invalidateQueries({ queryKey: ['prospect-sites', prospectId] })
      setShowUploadModal(false)
      setSelectedFile(null)
      setLabel('')
      setFromStitch(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Error al subir el archivo'
      toast.error(msg)
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await axios.delete(`/api/prospects/${prospectId}/sites/${deleteTarget.id}`)
      toast.success('Sitio eliminado')
      queryClient.invalidateQueries({ queryKey: ['prospect-sites', prospectId] })
      setDeleteTarget(null)
    } catch {
      toast.error('Error al eliminar el sitio')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Landings del Prospecto
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {sites.length === 0
                ? 'Sube un ZIP con la landing page'
                : `${sites.length} landing${sites.length !== 1 ? 's' : ''} disponible${sites.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Subir ZIP
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Cargando...
            </div>
          )}

          {!isLoading && sites.length === 0 && (
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-slate-500 font-medium">Arrastra o haz clic para subir un ZIP</p>
              <p className="text-xs text-slate-400 mt-1">La landing se descomprimirá en /sites/ automáticamente</p>
            </div>
          )}

          {!isLoading && sites.length > 0 && (
            <div className="space-y-3">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className={`p-3 rounded-lg border bg-white transition-colors ${
                    favoriteUrl === site.publicUrl
                      ? 'border-amber-300'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      site.source === 'generated'
                        ? 'bg-violet-100 text-violet-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {site.source === 'generated' ? (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{site.label}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <a
                          href={site.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-800 hover:underline truncate"
                        >
                          {site.publicUrl}
                        </a>
                        <span>·</span>
                        <span>{site.fileCount} archivos</span>
                        <span>·</span>
                        <span>{formatDate(site.createdAt)}</span>
                      </div>
                    </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectFavorite(site.publicUrl)}
                      title={favoriteUrl === site.publicUrl ? 'Landing favorita' : 'Marcar como favorita'}
                    >
                      <svg
                        className={`w-4 h-4 ${
                          favoriteUrl === site.publicUrl
                            ? 'text-amber-500'
                            : 'text-slate-400 hover:text-amber-500'
                        }`}
                        fill={favoriteUrl === site.publicUrl ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l2.041 6.275a1 1 0 00.95.69h6.598c.969 0 1.371 1.24.588 1.81l-5.338 3.879a1 1 0 00-.364 1.118l2.04 6.275c.3.921-.755 1.688-1.54 1.118l-5.337-3.878a1 1 0 00-1.176 0l-5.337 3.878c-.784.57-1.838-.197-1.539-1.118l2.04-6.275a1 1 0 00-.364-1.118L.872 11.702c-.783-.57-.38-1.81.588-1.81h6.598a1 1 0 00.95-.69l2.04-6.275z"
                        />
                      </svg>
                    </Button>
                    <a
                      href={site.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir sitio"
                    >
                      <Button variant="ghost" size="sm">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(site)}
                      title="Eliminar sitio"
                    >
                      <svg className="w-4 h-4 text-red-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                    </div>
                  </div>
                  {favoriteUrl === site.publicUrl && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Favorita (URL web propuesta)
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          if (!isUploading) {
            setShowUploadModal(false)
            setSelectedFile(null)
            setLabel('')
          }
        }}
        title="Subir Landing Page"
        size="sm"
      >
        <div className="space-y-4">
          {selectedFile && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <svg className="w-8 h-8 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{formatSize(selectedFile.size)}</p>
              </div>
            </div>
          )}

          <Input
            label="Etiqueta"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Versión inicial, Rediseño v2..."
            disabled={isUploading}
          />

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={fromStitch}
              onChange={(e) => setFromStitch(e.target.checked)}
              disabled={isUploading}
              className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Proyecto de Stitch</span>
              <p className="text-xs text-slate-400">Se convertira automaticamente a proyecto web estandar</p>
            </div>
          </label>

          {uploadProgress && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {uploadProgress}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowUploadModal(false)
                setSelectedFile(null)
                setLabel('')
              }}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              isLoading={isUploading}
              disabled={!selectedFile || isUploading}
            >
              Subir y Descomprimir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Eliminar sitio"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Se eliminará <strong>{deleteTarget?.label}</strong> y todos sus archivos en{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">site/{deleteTarget?.slug}/</code>.
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
