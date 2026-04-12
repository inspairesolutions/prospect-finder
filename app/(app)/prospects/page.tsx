'use client'

import { ProspectFilters } from '@/components/prospects/prospect-filters'
import { ProspectList } from '@/components/prospects/prospect-list'

export default function ProspectsPage() {
  return (
    <div className="space-y-6">
      <ProspectFilters />
      <ProspectList />
    </div>
  )
}
