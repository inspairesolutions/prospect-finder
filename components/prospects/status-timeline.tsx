import { formatDateTime, getStatusLabel, getStatusColor } from '@/lib/utils'
import { StatusHistory } from '@/types'

interface StatusTimelineProps {
  history: StatusHistory[]
}

export function StatusTimeline({ history }: StatusTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">Sin historial de cambios</p>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-200" />
      <div className="space-y-4">
        {history.map((item, index) => (
          <div key={item.id} className="relative pl-7">
            <div
              className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white ${
                index === 0 ? 'bg-primary-500' : 'bg-slate-300'
              }`}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {item.fromStatus && (
                  <>
                    <span className={`badge ${getStatusColor(item.fromStatus)}`}>
                      {getStatusLabel(item.fromStatus)}
                    </span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
                <span className={`badge ${getStatusColor(item.toStatus)}`}>
                  {getStatusLabel(item.toStatus)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {formatDateTime(item.createdAt)}
              </p>
              {item.notes && (
                <p className="text-xs text-slate-500 mt-1">{item.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
