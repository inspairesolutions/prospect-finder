'use client'

import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useSearchStore, SearchResult } from '@/store/search'
import toast from 'react-hot-toast'

interface SearchResponse {
  results: SearchResult[]
  total: number
}

export function useSearch() {
  const { setResults, setLoading, setError } = useSearchStore()

  return useMutation({
    mutationFn: async (params: {
      query?: string
      category?: string
      location: string
      latitude: number
      longitude: number
      radius: number
    }): Promise<SearchResponse> => {
      setLoading(true)
      const response = await axios.post('/api/search', params)
      return response.data
    },
    onSuccess: (data) => {
      setResults(data.results)
      setLoading(false)
      if (data.results.length === 0) {
        toast('No se encontraron resultados', { icon: '🔍' })
      }
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      setError(error.response?.data?.error || 'Error en la búsqueda')
      toast.error(error.response?.data?.error || 'Error en la búsqueda')
    },
  })
}
