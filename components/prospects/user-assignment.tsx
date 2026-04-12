'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useSession } from 'next-auth/react'

interface UserOption {
  id: string
  name: string
  email: string
}

interface UserAssignmentProps {
  assignedTo: string | null
  assignedUser?: { id: string; name: string; email: string } | null
  onAssign: (userId: string | null) => void
}

export function UserAssignment({ assignedTo, assignedUser, onAssign }: UserAssignmentProps) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await axios.get('/api/users')
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (userId: string | null) => {
    onAssign(userId)
    setOpen(false)
  }

  const handleAssignToMe = () => {
    if (session?.user?.id) {
      handleSelect(session.user.id)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm hover:bg-slate-100 transition-colors"
      >
        {assignedUser ? (
          <>
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
              {assignedUser.name[0]?.toUpperCase()}
            </span>
            <span className="text-slate-700">{assignedUser.name.split(' ')[0]}</span>
          </>
        ) : (
          <>
            <span className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <span className="text-slate-400">Asignar</span>
          </>
        )}
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
          {/* Assign to me shortcut */}
          {session?.user?.id && session.user.id !== assignedTo && (
            <button
              onClick={handleAssignToMe}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 transition-colors font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Asignarme
            </button>
          )}

          {/* Unassign option */}
          {assignedTo && (
            <button
              onClick={() => handleSelect(null)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Sin asignar
            </button>
          )}

          {(assignedTo || (session?.user?.id && session.user.id !== assignedTo)) && (
            <div className="border-t border-slate-100 my-1" />
          )}

          {/* User list */}
          {users?.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                user.id === assignedTo
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                {user.name[0]?.toUpperCase()}
              </span>
              <span className="truncate">{user.name}</span>
              {user.id === assignedTo && (
                <svg className="w-4 h-4 ml-auto text-primary-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
