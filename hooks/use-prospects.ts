'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Prospect, UpdateProspectInput } from '@/types'
import { useProspectsStore } from '@/store/prospects'
import toast from 'react-hot-toast'

export function useProspects() {
  const { filters, page, limit } = useProspectsStore()

  return useQuery({
    queryKey: ['prospects', filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      params.set('sortBy', filters.sortBy)
      params.set('sortOrder', filters.sortOrder)

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          filters.status.forEach((s) => params.append('statuses', s))
        } else {
          params.set('status', filters.status)
        }
      }

      if (filters.hasWebsite != null) {
        params.set('hasWebsite', filters.hasWebsite.toString())
      }

      if (filters.hasPhone != null) {
        params.set('hasPhone', filters.hasPhone.toString())
      }

      if (filters.minRating) {
        params.set('minRating', filters.minRating.toString())
      }

      if (filters.maxRating) {
        params.set('maxRating', filters.maxRating.toString())
      }

      if (filters.search) {
        params.set('search', filters.search)
      }

      if (filters.onlyMine) {
        params.set('onlyMine', 'true')
      }

      const response = await axios.get(`/api/prospects?${params.toString()}`)
      return response.data
    },
  })
}

export function useProspect(id: string) {
  return useQuery({
    queryKey: ['prospect', id],
    queryFn: async () => {
      const response = await axios.get(`/api/prospects/${id}`)
      return response.data as Prospect
    },
    enabled: !!id,
  })
}

export function useCreateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (placeId: string) => {
      const response = await axios.post('/api/prospects', { placeId })
      return response.data as Prospect
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Prospecto agregado')
    },
    onError: (error: { response?: { data?: { error?: string }; status?: number } }) => {
      if (error.response?.status === 409) {
        toast.error('Este prospecto ya existe')
      } else {
        toast.error(error.response?.data?.error || 'Error al agregar prospecto')
      }
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProspectInput }) => {
      const response = await axios.put(`/api/prospects/${id}`, data)
      return response.data as Prospect
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect', data.id] })
      toast.success('Prospecto actualizado')
    },
    onError: () => {
      toast.error('Error al actualizar prospecto')
    },
  })
}

export function useUpdateProspectStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string
      status: string
      notes?: string
    }) => {
      const response = await axios.patch(`/api/prospects/${id}/status`, {
        status,
        notes,
      })
      return response.data as Prospect
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect', data.id] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Estado actualizado')
    },
    onError: (error: { response?: { data?: { error?: string; missingFields?: string[] } } }) => {
      if (error.response?.data?.missingFields) {
        toast.error(`Campos requeridos: ${error.response.data.missingFields.join(', ')}`)
      } else {
        toast.error(error.response?.data?.error || 'Error al actualizar estado')
      }
    },
  })
}

export function useDeleteProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/prospects/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Prospecto eliminado')
    },
    onError: () => {
      toast.error('Error al eliminar prospecto')
    },
  })
}

// ─── Discarded places ─────────────────────────────────────────────────────────

export function useDiscardedPlaces() {
  return useQuery<string[]>({
    queryKey: ['discarded'],
    queryFn: async () => {
      const res = await axios.get('/api/discarded')
      return res.data
    },
    staleTime: 30_000,
  })
}

export function useDiscardPlace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (placeId: string) => {
      await axios.post('/api/discarded', { placeId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discarded'] })
      toast.success('Descartado — no aparecerá en futuras búsquedas')
    },
    onError: () => {
      toast.error('Error al descartar')
    },
  })
}

export function useUndiscardPlace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (placeId: string) => {
      await axios.delete(`/api/discarded/${encodeURIComponent(placeId)}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discarded'] })
      toast.success('Descarte eliminado')
    },
    onError: () => {
      toast.error('Error al eliminar descarte')
    },
  })
}
