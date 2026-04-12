import { create } from 'zustand'
import { ProspectStatus } from '@prisma/client'

interface SearchFilters {
  status?: ProspectStatus | ProspectStatus[]
  hasWebsite?: boolean | null
  hasPhone?: boolean | null
  minRating?: number | null
  maxRating?: number | null
  search?: string
  sortBy: 'createdAt' | 'name' | 'googleRating' | 'priority' | 'updatedAt'
  sortOrder: 'asc' | 'desc'
  onlyMine?: boolean
}

interface ProspectsState {
  // Filters
  filters: SearchFilters
  setFilters: (filters: Partial<SearchFilters>) => void
  resetFilters: () => void

  // Pagination
  page: number
  limit: number
  setPage: (page: number) => void
  setLimit: (limit: number) => void

  // View mode
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void

  // Selection
  selectedIds: Set<string>
  toggleSelection: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
}

const defaultFilters: SearchFilters = {
  status: undefined,
  hasWebsite: null,
  hasPhone: null,
  minRating: null,
  maxRating: null,
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  onlyMine: false,
}

function loadOnlyMine(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('prospect-filter-onlyMine') === 'true'
  } catch {
    return false
  }
}

function saveOnlyMine(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('prospect-filter-onlyMine', String(value))
  } catch {
    // ignore
  }
}

export const useProspectsStore = create<ProspectsState>((set) => ({
  // Filters
  filters: { ...defaultFilters, onlyMine: loadOnlyMine() },
  setFilters: (newFilters) =>
    set((state) => {
      if (newFilters.onlyMine !== undefined) {
        saveOnlyMine(newFilters.onlyMine)
      }
      return {
        filters: { ...state.filters, ...newFilters },
        page: 1, // Reset page when filters change
      }
    }),
  resetFilters: () => {
    saveOnlyMine(false)
    return set({ filters: defaultFilters, page: 1 })
  },

  // Pagination
  page: 1,
  limit: 20,
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),

  // View mode
  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),

  // Selection
  selectedIds: new Set(),
  toggleSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedIds)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return { selectedIds: newSet }
    }),
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
}))
