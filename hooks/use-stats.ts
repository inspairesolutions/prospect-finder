'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Stats } from '@/types'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await axios.get('/api/stats')
      return response.data as Stats
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
