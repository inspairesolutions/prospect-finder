import { cn } from '@/lib/utils'
import { getStatusColor, getStatusLabel } from '@/lib/utils'

interface BadgeProps {
  children?: React.ReactNode
  status?: string
  variant?: 'default' | 'outline'
  className?: string
}

export function Badge({ children, status, variant = 'default', className }: BadgeProps) {
  if (status) {
    return (
      <span className={cn('badge', getStatusColor(status), className)}>
        {getStatusLabel(status)}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'badge',
        variant === 'default'
          ? 'bg-slate-100 text-slate-800'
          : 'border border-slate-300 text-slate-600',
        className
      )}
    >
      {children}
    </span>
  )
}
