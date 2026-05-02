'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LandingGenerator } from './landing-generator'
import { SiteGenerator } from './site-generator'
import { SiteManager } from './site-manager'

interface LandingsBlockProps {
  prospectId: string
  hasEnoughData: boolean
  favoriteUrl?: string | null
  onSelectFavorite: (url: string) => void
  value: string
  onValueChange: (value: string) => void
}

export function LandingsBlock({
  prospectId,
  hasEnoughData,
  favoriteUrl,
  onSelectFavorite,
  value,
  onValueChange,
}: LandingsBlockProps) {
  const { data: sites = [] } = useQuery({
    queryKey: ['prospect-sites', prospectId],
    queryFn: async () => (await axios.get(`/api/prospects/${prospectId}/sites`)).data as Array<{ id: string }>,
  })
  const resolvedValue = value || (sites.length > 0 ? 'published' : 'quick')

  return (
    <Card>
      <Tabs value={resolvedValue} onValueChange={onValueChange}>
        <CardHeader>
          <TabsList>
            <TabsTrigger value="quick">Generador rapido</TabsTrigger>
            <TabsTrigger value="advanced">Generador avanzado</TabsTrigger>
            <TabsTrigger value="published" badge={sites.length}>Publicadas</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="quick">
            <LandingGenerator prospectId={prospectId} hasEnoughData={hasEnoughData} embedded />
          </TabsContent>
          <TabsContent value="advanced">
            <SiteGenerator prospectId={prospectId} hasEnoughData={hasEnoughData} embedded />
          </TabsContent>
          <TabsContent value="published">
            <SiteManager prospectId={prospectId} favoriteUrl={favoriteUrl} onSelectFavorite={onSelectFavorite} embedded />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
