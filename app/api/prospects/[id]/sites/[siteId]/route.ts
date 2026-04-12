import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { deletePrefix } from '@/lib/storage'

// ── DELETE — remove a site (DB record + files from DO Spaces) ───────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; siteId: string }> }
) {
  const { id, siteId } = await params

  const site = await prisma.prospectSite.findFirst({
    where: { id: siteId, prospectId: id },
  })

  if (!site) {
    return Response.json({ error: 'Site not found' }, { status: 404 })
  }

  // Remove all files from DO Spaces under site/{slug}/
  await deletePrefix(`site/${site.slug}/`).catch(() => {})

  // Remove DB record
  await prisma.prospectSite.delete({ where: { id: siteId } })

  return Response.json({ message: 'Sitio eliminado' })
}
