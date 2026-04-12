'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ProspectDetail } from '@/components/prospects/prospect-detail'
import { Button } from '@/components/ui/button'

export default function ProspectPage() {
  const params = useParams()
  const id = params.id as string

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/prospects">
          <Button variant="ghost" size="sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver
          </Button>
        </Link>
      </div>
      <ProspectDetail id={id} />
    </div>
  )
}
