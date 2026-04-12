import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ProspectStatus } from '@prisma/client'

export async function GET() {
  try {
    // Get total count
    const total = await prisma.prospect.count()

    // Get counts by status
    const statusCounts = await prisma.prospect.groupBy({
      by: ['status'],
      _count: true,
    })

    const byStatus: Record<ProspectStatus, number> = {
      NEW: 0,
      IN_CONSTRUCTION: 0,
      CONTACTED: 0,
      INTERESTED: 0,
      NOT_INTERESTED: 0,
      READY: 0,
      CONVERTED: 0,
      ARCHIVED: 0,
    }

    statusCounts.forEach((item) => {
      byStatus[item.status] = item._count
    })

    // Get this week's count
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const thisWeek = await prisma.prospect.count({
      where: {
        createdAt: { gte: startOfWeek },
      },
    })

    // Get this month's count
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonth = await prisma.prospect.count({
      where: {
        createdAt: { gte: startOfMonth },
      },
    })

    // Get recent activity
    const recentProspects = await prisma.prospect.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        createdAt: true,
      },
    })

    const recentStatusChanges = await prisma.statusHistory.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        prospect: {
          select: { id: true, name: true },
        },
      },
    })

    const recentActivity = [
      ...recentProspects.map((p) => ({
        id: `prospect-${p.id}`,
        type: p.createdAt.getTime() === p.updatedAt.getTime() ? 'created' : 'updated',
        prospectId: p.id,
        prospectName: p.name,
        timestamp: p.updatedAt,
      })),
      ...recentStatusChanges.map((s) => ({
        id: `status-${s.id}`,
        type: 'status_changed',
        prospectId: s.prospect.id,
        prospectName: s.prospect.name,
        timestamp: s.createdAt,
        details: `${s.fromStatus || 'None'} → ${s.toStatus}`,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return NextResponse.json({
      total,
      byStatus,
      thisWeek,
      thisMonth,
      recentActivity,
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
