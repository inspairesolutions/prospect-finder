'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ProspectFile } from '@/types'
import toast from 'react-hot-toast'

export function useProspectFiles(prospectId: string) {
  return useQuery({
    queryKey: ['prospect-files', prospectId],
    queryFn: async () => {
      const response = await axios.get(`/api/prospects/${prospectId}/files`)
      return response.data as ProspectFile[]
    },
    enabled: !!prospectId,
  })
}

export function useUploadFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ prospectId, file }: { prospectId: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post(`/api/prospects/${prospectId}/files`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data as ProspectFile
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect-files', variables.prospectId] })
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.prospectId] })
      toast.success('Archivo subido')
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || 'Error al subir archivo')
    },
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ prospectId, fileId }: { prospectId: string; fileId: string }) => {
      await axios.delete(`/api/prospects/${prospectId}/files?fileId=${fileId}`)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospect-files', variables.prospectId] })
      queryClient.invalidateQueries({ queryKey: ['prospect', variables.prospectId] })
      toast.success('Archivo eliminado')
    },
    onError: () => {
      toast.error('Error al eliminar archivo')
    },
  })
}
