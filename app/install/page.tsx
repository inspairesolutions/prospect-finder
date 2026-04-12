import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSeedInstallState, runSeedFromEnv } from '@/lib/initial-admin'
import { isInstallAllowed } from '@/lib/install-allowed'

export const metadata: Metadata = {
  title: 'Instalación | Prospect Finder',
  description: 'Configuración inicial de la aplicación',
}

function InstallShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-primary-50/30 to-secondary-50/30 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary-500/25 mb-4">
              P
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Instalación</h1>
          </div>
          {children}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          Inspaire Solutions &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

export default async function InstallPage() {
  if (!isInstallAllowed()) {
    notFound()
  }

  const state = await getSeedInstallState()

  if (state.kind === 'installed') {
    redirect('/dashboard')
  }

  if (state.kind === 'missing_env') {
    return (
      <InstallShell>
        <p className="text-sm text-slate-600 text-center">
          Define <code className="text-xs bg-slate-100 px-1 rounded">SEED_ADMIN_EMAIL</code>,{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">SEED_ADMIN_NAME</code> y{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">SEED_ADMIN_PASSWORD</code> en tu archivo{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">.env</code> y vuelve a cargar esta página.
        </p>
      </InstallShell>
    )
  }

  try {
    await runSeedFromEnv()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo completar la instalación.'
    return (
      <InstallShell>
        <p className="text-sm text-red-700 text-center">{message}</p>
      </InstallShell>
    )
  }

  redirect('/login?installed=1')
}
