'use client'

import { SearchForm } from '@/components/search/search-form'
import { SearchResults } from '@/components/search/search-results'
import { SearchHistory } from '@/components/search/search-history'
import { useSearchStore } from '@/store/search'

export default function SearchPage() {
  const { results } = useSearchStore()

  return (
    <div className="space-y-6">
      <SearchForm />

      {results.length === 0 && (
        <SearchHistory />
      )}

      <SearchResults />
    </div>
  )
}
