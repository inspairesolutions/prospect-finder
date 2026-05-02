'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Prospect } from '@/types'
import { ResearchPanel } from './research-panel'
import { WebAnalysis } from './web-analysis'

interface IntelligenceBlockProps {
  prospectId: string
  prospect: Prospect
  value: string
  onValueChange: (value: string) => void
}

export function IntelligenceBlock({ prospectId, prospect, value, onValueChange }: IntelligenceBlockProps) {
  return (
    <Card>
      <Tabs value={value} onValueChange={onValueChange}>
        <CardHeader>
          <TabsList>
            <TabsTrigger value="research">Investigacion</TabsTrigger>
            <TabsTrigger value="web" badge={prospect.webAnalysisScore ?? undefined}>Analisis web</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="research">
            <ResearchPanel prospectId={prospectId} prospect={prospect} />
          </TabsContent>
          <TabsContent value="web">
            <WebAnalysis prospectId={prospectId} website={prospect.website} embedded />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
