'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsCardSkeleton } from '@/components/ui/skeleton'
import { useStats } from '@/hooks/use-stats'
import { formatRelativeTime } from '@/lib/utils'

const statCards = [
  { key: 'total', label: 'Total Prospectos', color: 'text-slate-900', bgColor: 'bg-slate-50' },
  { key: 'READY', label: 'Listos', color: 'text-green-700', bgColor: 'bg-green-50' },
  { key: 'IN_CONSTRUCTION', label: 'En Construcción', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  { key: 'CONTACTED', label: 'Contactados', color: 'text-violet-700', bgColor: 'bg-violet-50' },
]

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats()

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bienvenido a Prospect Finder</h1>
          <p className="text-slate-500 mt-1">Gestiona tus prospectos de negocios locales</p>
        </div>
        <Link href="/search">
          <Button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Nueva búsqueda
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)
        ) : (
          statCards.map((card) => {
            const value = card.key === 'total'
              ? stats?.total || 0
              : stats?.byStatus[card.key as keyof typeof stats.byStatus] || 0
            return (
              <Card key={card.key} className={card.bgColor}>
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-slate-600">{card.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${card.color}`}>{value}</p>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* This Week / This Month */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Resumen</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Esta semana</span>
              <span className="text-lg font-semibold text-slate-900">
                {isLoading ? '-' : stats?.thisWeek || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Este mes</span>
              <span className="text-lg font-semibold text-slate-900">
                {isLoading ? '-' : stats?.thisMonth || 0}
              </span>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Sin web</span>
                <span className="text-sm font-medium text-amber-600">
                  {/* This would need a separate query */}
                  Ver en prospectos
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Por estado</h3>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats?.byStatus || {})
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <Badge status={status} />
                      <span className="text-sm font-medium text-slate-900">{count}</span>
                    </div>
                  ))}
                {Object.values(stats?.byStatus || {}).every((v) => v === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Sin prospectos aún</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="font-semibold text-slate-900">Actividad reciente</h3>
            <Link href="/prospects" className="text-xs text-primary-600 hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-full animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.slice(0, 5).map((activity) => (
                  <Link
                    key={activity.id}
                    href={`/prospects/${activity.prospectId}`}
                    className="flex items-start gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      {activity.type === 'created' && (
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {activity.type === 'updated' && (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      )}
                      {activity.type === 'status_changed' && (
                        <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 group-hover:text-primary-600 truncate">
                        {activity.prospectName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activity.type === 'created' && 'Creado'}
                        {activity.type === 'updated' && 'Actualizado'}
                        {activity.type === 'status_changed' && activity.details}
                        {' · '}
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Sin actividad reciente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Acciones rápidas</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/search">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center mb-3 group-hover:bg-primary-200">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h4 className="font-medium text-slate-900">Buscar negocios</h4>
                <p className="text-sm text-slate-500 mt-1">Encuentra nuevos prospectos en tu zona</p>
              </div>
            </Link>

            <Link href="/prospects?status=NEW">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3 group-hover:bg-blue-200">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="font-medium text-slate-900">Revisar nuevos</h4>
                <p className="text-sm text-slate-500 mt-1">Prospectos pendientes de investigar</p>
              </div>
            </Link>

            <Link href="/prospects?status=READY">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-all group cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-3 group-hover:bg-green-200">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-medium text-slate-900">Ver listos</h4>
                <p className="text-sm text-slate-500 mt-1">Prospectos listos para contactar</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
