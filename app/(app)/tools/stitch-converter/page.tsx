'use client'

import { useState, useRef, useCallback } from 'react'

export default function StitchConverterPage() {
  const [file, setFile] = useState<File | null>(null)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
    setSuccess(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setConverting(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('stitch_zip', file)

    try {
      const response = await fetch('/api/stitch-convert', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error en la conversión')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = response.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="(.+)"/)
      a.download = match ? match[1] : 'proyecto_convertido.zip'
      a.href = url
      a.click()
      URL.revokeObjectURL(url)

      setSuccess('Proyecto convertido y descargado correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setConverting(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Stitch to Project</h1>
        <p className="text-slate-500 mt-1">
          Sube un ZIP exportado de Google Stitch y descarga un proyecto web listo para usar.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <form onSubmit={handleSubmit}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
              ${dragOver
                ? 'border-primary-500 bg-primary-50 scale-[1.01]'
                : 'border-slate-300 hover:border-primary-400 hover:bg-primary-50/30'
              }`}
          >
            {!file ? (
              <>
                <svg className="mx-auto mb-4 text-slate-400" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-slate-600 font-medium mb-1">Arrastra tu ZIP de Stitch aqui</p>
                <p className="text-slate-400 text-sm">o haz click para seleccionar</p>
              </>
            ) : (
              <>
                <svg className="mx-auto mb-3 text-primary-500" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-700 font-medium mb-1">{file.name}</p>
                <p className="text-slate-400 text-sm">{formatSize(file.size)}</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFile(e.target.files[0])
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!file || converting}
            className="mt-6 w-full bg-slate-900 text-white font-medium py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {converting ? (
              <>
                <span>Convirtiendo...</span>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </>
            ) : (
              <span>Convertir proyecto</span>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
            {success}
          </div>
        )}
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h2 className="font-semibold text-slate-900 mb-4">Que hace la conversion?</h2>
        <ul className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="text-primary-500 font-bold">1.</span>
            <span>Detecta si es un proyecto de una o varias pantallas</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary-500 font-bold">2.</span>
            <span>Extrae la configuracion de Tailwind a un archivo separado</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary-500 font-bold">3.</span>
            <span>Separa los estilos CSS y scripts JS en sus propios archivos</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary-500 font-bold">4.</span>
            <span>Crea una estructura <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">index.html</code> + <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">pages/</code> + <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">assets/</code></span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary-500 font-bold">5.</span>
            <span>En multi-pantalla, genera navegacion entre paginas</span>
          </li>
        </ul>

        <div className="mt-6 p-4 bg-slate-50 rounded-xl">
          <pre className="text-xs font-mono text-slate-500 leading-relaxed">
{`proyecto_convertido/
├── index.html
├── pages/
│   ├── pantalla1.html
│   └── pantalla2.html
├── assets/
│   ├── css/styles.css
│   ├── js/tailwind-config.js
│   └── images/
└── DESIGN.md`}
          </pre>
        </div>
      </div>
    </div>
  )
}
