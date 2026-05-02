import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * POST /api/prospects/[id]/analyze
 *
 * Creates an analysis job for the prospect's website.
 * The worker processes it asynchronously.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: { id: true, website: true, name: true },
    })

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }

    if (!prospect.website) {
      return NextResponse.json(
        { error: 'Prospect does not have a website' },
        { status: 400 }
      )
    }

    // Check if there's already a pending/running job
    const activeJob = await prisma.analysisJob.findFirst({
      where: {
        prospectId: id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    })

    if (activeJob) {
      return NextResponse.json({
        jobId: activeJob.id,
        status: activeJob.status,
        currentStep: activeJob.currentStep,
        message: 'Analysis already in progress',
      })
    }

    // Normalize URL
    let url = prospect.website.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }

    // Create a new analysis job
    const job = await prisma.analysisJob.create({
      data: {
        prospectId: id,
        url,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      message: 'Analysis job created',
    }, { status: 201 })
  } catch (error) {
    console.error('Create analysis job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create analysis job' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/prospects/[id]/analyze
 *
 * Returns existing analysis data + active job status if any
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prospect = await prisma.prospect.findUnique({
      where: { id },
      select: {
        webAnalysis: true,
        webAnalysisScore: true,
        webAnalysisCategory: true,
        webAnalyzedAt: true,
        website: true,
      },
    })

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      )
    }

    // Check for active job
    const activeJob = await prisma.analysisJob.findFirst({
      where: {
        prospectId: id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Check for most recent failed job (only if no analysis exists)
    const lastFailedJob = !prospect.webAnalysis ? await prisma.analysisJob.findFirst({
      where: {
        prospectId: id,
        status: 'FAILED',
      },
      orderBy: { createdAt: 'desc' },
    }) : null

    // Get screenshots from latest completed job
    const lastDoneJob = await prisma.analysisJob.findFirst({
      where: {
        prospectId: id,
        status: 'DONE',
        screenshots: { not: Prisma.DbNull },
      },
      orderBy: { finishedAt: 'desc' },
      select: { screenshots: true },
    })

    const jobStatus = activeJob
      ? { status: activeJob.status, step: activeJob.currentStep, jobId: activeJob.id }
      : lastFailedJob
        ? { status: 'FAILED' as const, step: null, jobId: lastFailedJob.id, error: lastFailedJob.errorMessage }
        : null

    if (!prospect.webAnalysis) {
      return NextResponse.json({
        hasAnalysis: false,
        hasWebsite: !!prospect.website,
        job: jobStatus,
        screenshots: lastDoneJob?.screenshots ?? null,
      })
    }

    return NextResponse.json({
      hasAnalysis: true,
      analysis: JSON.parse(prospect.webAnalysis),
      score: prospect.webAnalysisScore,
      category: prospect.webAnalysisCategory,
      analyzedAt: prospect.webAnalyzedAt,
      job: jobStatus,
      screenshots: lastDoneJob?.screenshots ?? null,
    })
  } catch (error) {
    console.error('Get analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/prospects/[id]/analyze
 *
 * Deletes existing analysis and cancels any active jobs
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Cancel any active jobs
    await prisma.analysisJob.updateMany({
      where: {
        prospectId: id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'CANCELLED' },
    })

    // Clear analysis data from prospect
    await prisma.prospect.update({
      where: { id },
      data: {
        webAnalysis: null,
        webAnalysisScore: null,
        webAnalysisCategory: null,
        webAnalyzedAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to delete analysis' },
      { status: 500 }
    )
  }
}
