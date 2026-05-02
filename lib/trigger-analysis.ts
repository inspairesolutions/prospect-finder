import prisma from '@/lib/prisma'

export async function triggerBackgroundAnalysis(prospectId: string, url: string): Promise<string> {
  const job = await prisma.analysisJob.create({
    data: {
      prospectId,
      url,
      status: 'PENDING',
    },
  })

  return job.id
}
