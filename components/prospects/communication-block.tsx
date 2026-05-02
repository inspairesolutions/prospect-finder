'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmailThreadPanel } from './email-thread'
import { EmailGenerator } from './email-generator'

interface CommunicationBlockProps {
  prospectId: string
  prospectName: string
  prospectEmail?: string | null
  hasWebsite: boolean
  hasProposedUrl: boolean
  value: string
  onValueChange: (value: string) => void
}

export function CommunicationBlock({
  prospectId,
  prospectName,
  prospectEmail,
  hasWebsite,
  hasProposedUrl,
  value,
  onValueChange,
}: CommunicationBlockProps) {
  const { data: threads = [] } = useQuery({
    queryKey: ['threads', prospectId],
    queryFn: async () => (await axios.get(`/api/prospects/${prospectId}/threads`)).data as Array<{ unreadCount?: number }>,
  })
  const unread = threads.reduce((acc, t) => acc + (t.unreadCount ?? 0), 0)

  return (
    <Card>
      <Tabs value={value} onValueChange={onValueChange}>
        <CardHeader>
          <TabsList>
            <TabsTrigger value="thread" badge={unread > 0 ? unread : undefined}>Hilo de correo</TabsTrigger>
            <TabsTrigger value="ai">Generador IA</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="thread">
            <EmailThreadPanel
              prospectId={prospectId}
              prospectName={prospectName}
              prospectEmail={prospectEmail}
              hasWebsite={hasWebsite}
              hasProposedUrl={hasProposedUrl}
              embedded
            />
          </TabsContent>
          <TabsContent value="ai">
            <EmailGenerator
              prospectId={prospectId}
              prospectName={prospectName}
              hasWebsite={hasWebsite}
              hasProposedUrl={hasProposedUrl}
              embedded
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}
