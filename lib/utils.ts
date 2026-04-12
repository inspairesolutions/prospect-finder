import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'ahora mismo'
  if (diffMins < 60) return `hace ${diffMins} min`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays < 7) return `hace ${diffDays}d`
  return formatDate(d)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NEW: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
    IN_CONSTRUCTION: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
    CONTACTED: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20',
    INTERESTED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    NOT_INTERESTED: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20',
    READY: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
    CONVERTED: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20',
    ARCHIVED: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20',
  }
  return colors[status] || 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'Nuevo',
    IN_CONSTRUCTION: 'En Construcción',
    CONTACTED: 'Contactado',
    INTERESTED: 'Interesado',
    NOT_INTERESTED: 'No Interesado',
    READY: 'Listo',
    CONVERTED: 'Convertido',
    ARCHIVED: 'Archivado',
  }
  return labels[status] || status
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

export function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return url
  }
}
