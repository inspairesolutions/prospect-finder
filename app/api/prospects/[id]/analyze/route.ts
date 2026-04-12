import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { existsSync } from 'fs'
import { promisify } from 'util'
import path from 'path'
import prisma from '@/lib/prisma'

const execAsync = promisify(exec)

function isOnlyKnownPythonWarning(stderr: string): boolean {
  const trimmed = stderr.trim()
  if (!trimmed) return false

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return false

  // urllib3 warning commonly shown with macOS system Python + LibreSSL.
  const allowedPatterns = [
    /NotOpenSSLWarning/,
    /urllib3 v2 only supports OpenSSL 1\.1\.1\+/,
    /warnings\.warn\(/,
    /urllib3\/__init__\.py:\d+:/,
  ]

  return lines.every((line) =>
    allowedPatterns.some((pattern) => pattern.test(line))
  )
}

function tryExtractJsonObject(output: string): string | null {
  const trimmed = output.trim()
  if (!trimmed) return null

  // Fast path: full output is already JSON.
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  // Fallback: extract from first "{" to last "}".
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }
  return trimmed.slice(firstBrace, lastBrace + 1)
}

function resolveWebAnalyzerPath(): string {
  const raw = process.env.WEB_ANALYZER_PATH?.trim()
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
  }
  return path.join(process.cwd(), 'web-analyzer')
}

interface WebAnalysisResult {
  url: string
  timestamp: string
  status: 'success' | 'error'
  error: string | null
  technology: {
    cms: string | null
    cms_version: string | null
    page_builder: string | null
    frameworks: string[]
    libraries: string[]
    analytics: string[]
  }
  design: {
    estimated_age: string
    estimated_year: number | null
    design_quality: string
    is_outdated: boolean
    age_score: number
  }
  performance: {
    load_time: number
    load_time_rating: string
    page_size: number
    page_size_rating: string
    issues: string[]
    recommendations: string[]
  }
  responsive: {
    is_mobile_friendly: boolean
    has_viewport_meta: boolean
    score: number
    issues: string[]
    recommendations: string[]
  }
  seo: {
    score: number
    has_title: boolean
    title: string | null
    has_meta_description: boolean
    meta_description: string | null
    issues: string[]
    recommendations: string[]
  }
  content: {
    emails: string[]
    phones: string[]
    address: string | null
    social_media: Record<string, string>
    estimated_pages: number
    word_count: number
    has_blog: boolean
    has_shop: boolean
  }
  technical: {
    ssl: {
      has_ssl: boolean
      is_valid: boolean
    }
    broken_links_count: number
    accessibility_issues: string[]
    missing_security_headers: string[]
    issues: string[]
    severity: string
  }
  business: {
    industry: string | null
    business_type: string | null
    is_local_business: boolean
    professionalism_score: number
    opportunity_factors: string[]
  }
  scoring: {
    total_score: number
    category: string
    recommendation: string
    positive_factors: string[]
    negative_factors: string[]
    breakdown: Record<string, { points: number; reasons: string[] }>
  }
}

interface ExecCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

async function runAnalyzeCommand(command: string): Promise<ExecCommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minutes timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })
    return { stdout, stderr, exitCode: 0 }
  } catch (error) {
    const execError = error as Error & {
      code?: number
      stdout?: string
      stderr?: string
    }
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: typeof execError.code === 'number' ? execError.code : 1,
    }
  }
}

/**
 * POST /api/prospects/[id]/analyze
 *
 * Executes web analysis on the prospect's website
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get prospect
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

    // Normalize URL
    let url = prospect.website.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`
    }

    const analyzerDir = resolveWebAnalyzerPath()
    const analyzeScript = path.join(analyzerDir, 'analyze')
    if (!existsSync(analyzeScript)) {
      return NextResponse.json(
        {
          error:
            'Analizador web no encontrado. Clona el repo con la carpeta web-analyzer, o define WEB_ANALYZER_PATH. Ver web-analyzer/README.md.',
        },
        { status: 500 }
      )
    }

    console.log(`Analyzing website: ${url} for prospect: ${prospect.name} (analyzer: ${analyzerDir})`)

    const command = `cd "${analyzerDir}" && ./analyze "${url}" --json --no-link-check`

    const { stdout, stderr, exitCode } = await runAnalyzeCommand(command)

    if (stderr && !stdout && !isOnlyKnownPythonWarning(stderr)) {
      console.error('Web analyzer stderr:', stderr)
      return NextResponse.json(
        { error: 'Web analysis failed', details: stderr },
        { status: 500 }
      )
    }

    // If analyzer exited with error, do not try to parse output as JSON.
    if (exitCode !== 0) {
      const cleanStderr = stderr?.trim()
      const cleanStdout = stdout?.trim()
      const details =
        cleanStderr && !isOnlyKnownPythonWarning(cleanStderr)
          ? cleanStderr
          : cleanStdout || `Analyzer exited with code ${exitCode}`
      console.error('Web analyzer failed:', { exitCode, stderr, stdout })
      return NextResponse.json(
        { error: 'Web analysis failed', details },
        { status: 500 }
      )
    }

    // Parse JSON result from analyzer stdout
    let analysis: WebAnalysisResult
    try {
      const jsonString = tryExtractJsonObject(stdout)
      if (!jsonString) {
        throw new Error('No JSON found in output')
      }
      analysis = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('Failed to parse analyzer output:', stdout)
      console.error('Parse error:', parseError)
      const details =
        stderr?.trim() && !isOnlyKnownPythonWarning(stderr)
          ? stderr
          : stdout.slice(0, 1000) || `Analyzer exited with code ${exitCode}`
      return NextResponse.json(
        { error: 'Failed to parse analysis result', details },
        { status: 500 }
      )
    }

    // Check if analysis was successful
    if (analysis.status === 'error') {
      return NextResponse.json(
        { error: analysis.error || 'Analysis failed' },
        { status: 500 }
      )
    }

    // Build extra fields to populate from analysis (only if currently empty)
    const current = await prisma.prospect.findUnique({
      where: { id },
      select: { contactEmail: true, facebookUrl: true, instagramUrl: true },
    })

    const extraData: Record<string, string> = {}
    if (!current?.contactEmail && analysis.content.emails.length > 0) {
      extraData.contactEmail = analysis.content.emails[0]
    }
    const socialMedia = analysis.content.social_media ?? {}
    if (!current?.facebookUrl && socialMedia.facebook) {
      const fb = socialMedia.facebook
      extraData.facebookUrl = fb.startsWith('http') ? fb : `https://${fb}`
    }
    if (!current?.instagramUrl && socialMedia.instagram) {
      const ig = socialMedia.instagram
      extraData.instagramUrl = ig.startsWith('http') ? ig : `https://${ig}`
    }

    // Save analysis to database
    const updatedProspect = await prisma.prospect.update({
      where: { id },
      data: {
        webAnalysis: JSON.stringify(analysis),
        webAnalysisScore: analysis.scoring?.total_score ?? null,
        webAnalysisCategory: analysis.scoring?.category ?? null,
        webAnalyzedAt: new Date(),
        ...extraData,
      },
    })

    return NextResponse.json({
      success: true,
      analysis,
      score: analysis.scoring?.total_score,
      category: analysis.scoring?.category,
      analyzedAt: updatedProspect.webAnalyzedAt,
    })
  } catch (error) {
    console.error('Analyze error:', error)

    // Handle timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        { error: 'Analysis timed out. The website may be slow or unresponsive.' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/prospects/[id]/analyze
 *
 * Returns existing analysis for a prospect
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

    if (!prospect.webAnalysis) {
      return NextResponse.json({
        hasAnalysis: false,
        hasWebsite: !!prospect.website,
      })
    }

    return NextResponse.json({
      hasAnalysis: true,
      analysis: JSON.parse(prospect.webAnalysis),
      score: prospect.webAnalysisScore,
      category: prospect.webAnalysisCategory,
      analyzedAt: prospect.webAnalyzedAt,
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
 * Deletes existing analysis for a prospect
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
