'use client'

import { useState } from 'react'
import axios from 'axios'

type TestResult = {
  status: 'idle' | 'success' | 'error'
  message: string
  timestamp?: string
  details?: {
    hostname?: string | null
    hostUsed?: string | null
    port?: number
    secure?: boolean
    dnsLookup?: Array<{ address: string; family: number }>
    code?: string | null
    errno?: string | number | null
    syscall?: string | null
    address?: string | null
    errorPort?: number | null
  }
}

export default function SmtpAdminPage() {
  const [isTesting, setIsTesting] = useState(false)
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testEmailSubject, setTestEmailSubject] = useState('Prueba SMTP - Prospect Finder')
  const [result, setResult] = useState<TestResult>({
    status: 'idle',
    message: 'Aun no se ha ejecutado la prueba de conexion SMTP.',
  })
  const [sendResult, setSendResult] = useState<TestResult>({
    status: 'idle',
    message: 'Aun no se ha enviado ningun correo de prueba.',
  })

  async function handleTestConnection() {
    setIsTesting(true)
    setResult({
      status: 'idle',
      message: 'Probando conexion con el servidor SMTP...',
    })

    try {
      const response = await axios.post('/api/admin/smtp/test')
      setResult({
        status: 'success',
        message: response.data?.message || 'Conexion SMTP satisfactoria',
        timestamp: response.data?.timestamp,
        details: response.data?.details,
      })
    } catch (error: unknown) {
      const data = axios.isAxiosError(error) ? error.response?.data : undefined
      const errorMessage =
        axios.isAxiosError(error)
          ? data?.error || 'No fue posible conectar al servidor SMTP.'
          : 'No fue posible conectar al servidor SMTP.'

      setResult({
        status: 'error',
        message: errorMessage,
        timestamp: data?.timestamp || new Date().toISOString(),
        details: data?.details,
      })
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSendTestEmail() {
    if (!testEmailTo.trim()) {
      setSendResult({
        status: 'error',
        message: 'Debes indicar un email de destino.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    setIsSendingTestEmail(true)
    setSendResult({
      status: 'idle',
      message: 'Enviando correo de prueba...',
    })

    try {
      const response = await axios.post('/api/admin/smtp/send-test', {
        toEmail: testEmailTo.trim(),
        subject: testEmailSubject.trim(),
      })
      setSendResult({
        status: 'success',
        message: response.data?.message || 'Correo de prueba enviado correctamente.',
        timestamp: response.data?.timestamp,
      })
    } catch (error: unknown) {
      const data = axios.isAxiosError(error) ? error.response?.data : undefined
      setSendResult({
        status: 'error',
        message: data?.error || 'No fue posible enviar el correo de prueba.',
        timestamp: data?.timestamp || new Date().toISOString(),
      })
    } finally {
      setIsSendingTestEmail(false)
    }
  }

  const resultStyles =
    result.status === 'success'
      ? 'bg-green-50 text-green-700 ring-green-600/20'
      : result.status === 'error'
        ? 'bg-red-50 text-red-700 ring-red-600/20'
        : 'bg-slate-50 text-slate-600 ring-slate-500/20'
  const sendResultStyles =
    sendResult.status === 'success'
      ? 'bg-green-50 text-green-700 ring-green-600/20'
      : sendResult.status === 'error'
        ? 'bg-red-50 text-red-700 ring-red-600/20'
        : 'bg-slate-50 text-slate-600 ring-slate-500/20'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Diagnostico SMTP</h2>
        <p className="text-sm text-slate-500 mt-1">
          Valida que la conexion al servidor de correo este funcionando antes de enviar emails a prospectos.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Prueba de conexion SMTP</p>
            <p className="text-xs text-slate-500 mt-1">
              Esta validacion usa las variables de entorno configuradas actualmente.
            </p>
          </div>
          <button onClick={handleTestConnection} disabled={isTesting} className="btn btn-primary">
            {isTesting ? 'Probando...' : 'Probar conexion SMTP'}
          </button>
        </div>

        <div className={`rounded-xl ring-1 p-4 ${resultStyles}`}>
          <p className="text-sm font-medium">
            {result.status === 'success'
              ? 'Conexion exitosa'
              : result.status === 'error'
                ? 'Conexion fallida'
                : 'Estado pendiente'}
          </p>
          <p className="text-sm mt-1">{result.message}</p>
          {result.timestamp && (
            <p className="text-xs mt-2 opacity-80">
              Ultima prueba: {new Date(result.timestamp).toLocaleString('es-ES')}
            </p>
          )}
          {result.details && (
            <div className="mt-3 text-xs opacity-90 space-y-1">
              <p>Host configurado: {result.details.hostname || 'N/A'}</p>
              <p>Host usado: {result.details.hostUsed || 'N/A'}</p>
              <p>Puerto: {result.details.port ?? 'N/A'} · SSL: {result.details.secure ? 'si' : 'no'}</p>
              {result.details.code && <p>Codigo de error: {result.details.code}</p>}
              {result.details.address && <p>Direccion de fallo: {result.details.address}</p>}
              {result.details.dnsLookup && result.details.dnsLookup.length > 0 && (
                <p>
                  DNS: {result.details.dnsLookup.map((entry) => `${entry.address} (IPv${entry.family})`).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-800">Envio de correo de prueba</p>
          <p className="text-xs text-slate-500 mt-1">
            Envia un email real para confirmar autenticacion SMTP, remitente y entrega inicial.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Email destino</label>
            <input
              type="email"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              className="input"
              placeholder="tu-correo@dominio.com"
            />
          </div>
          <div>
            <label className="label">Asunto (opcional)</label>
            <input
              type="text"
              value={testEmailSubject}
              onChange={(e) => setTestEmailSubject(e.target.value)}
              className="input"
              placeholder="Prueba SMTP - Prospect Finder"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSendTestEmail}
            disabled={isSendingTestEmail}
            className="btn btn-primary"
          >
            {isSendingTestEmail ? 'Enviando...' : 'Enviar correo de prueba'}
          </button>
        </div>

        <div className={`rounded-xl ring-1 p-4 ${sendResultStyles}`}>
          <p className="text-sm font-medium">
            {sendResult.status === 'success'
              ? 'Envio exitoso'
              : sendResult.status === 'error'
                ? 'Envio fallido'
                : 'Estado pendiente'}
          </p>
          <p className="text-sm mt-1">{sendResult.message}</p>
          {sendResult.timestamp && (
            <p className="text-xs mt-2 opacity-80">
              Ultimo intento: {new Date(sendResult.timestamp).toLocaleString('es-ES')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
