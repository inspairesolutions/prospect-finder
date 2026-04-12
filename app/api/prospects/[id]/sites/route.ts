import { NextRequest } from 'next/server'
import { mkdir, readdir, rm, readFile, writeFile, unlink, stat, rename, rmdir } from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import prisma from '@/lib/prisma'
import { uploadToStorage, CDN_BASE } from '@/lib/storage'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

// ── GET — list all sites for a prospect ─────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const sites = await prisma.prospectSite.findMany({
    where: { prospectId: id },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(sites)
}

// ── POST — upload a ZIP, decompress, upload files to DO Spaces ──────────────

const MAX_ZIP_SIZE = 100 * 1024 * 1024 // 100 MB

async function getAllFiles(dir: string, base: string = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(path.join(dir, entry.name), relative)))
    } else {
      files.push(relative)
    }
  }
  return files
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    select: { name: true },
  })

  if (!prospect) {
    return Response.json({ error: 'Prospect not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const label = (formData.get('label') as string) || 'Sitio subido'

  if (!file) {
    return Response.json({ error: 'No se envió ningún archivo' }, { status: 400 })
  }

  if (!file.name.endsWith('.zip')) {
    return Response.json({ error: 'Solo se aceptan archivos .zip' }, { status: 400 })
  }

  if (file.size > MAX_ZIP_SIZE) {
    return Response.json({ error: 'El archivo excede 100 MB' }, { status: 400 })
  }

  // Build a unique slug: prospect-slug-label-slug or prospect-slug-timestamp
  const prospectSlug = slugify(prospect.name)
  const labelSlug = slugify(label)
  let slug = labelSlug !== prospectSlug ? `${prospectSlug}-${labelSlug}` : prospectSlug

  // Ensure uniqueness by checking DB
  const existing = await prisma.prospectSite.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  // Extract ZIP to a temp directory
  const tmpDir = path.join('/tmp', `site-upload-${Date.now()}`)
  await mkdir(tmpDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())
  const tmpZipPath = path.join(tmpDir, '__upload.zip')
  await writeFile(tmpZipPath, buffer)

  try {
    execSync(`unzip -o "${tmpZipPath}" -d "${tmpDir}"`, {
      timeout: 30000,
      stdio: 'pipe',
    })
  } catch {
    await rm(tmpDir, { recursive: true, force: true })
    return Response.json(
      { error: 'Error al descomprimir el archivo ZIP' },
      { status: 400 }
    )
  }

  // Remove the temp zip
  await unlink(tmpZipPath).catch(() => {})

  // Check if the ZIP contained a single root folder — if so, move contents up
  const entries = await readdir(tmpDir)
  const nonHidden = entries.filter((e) => !e.startsWith('.') && e !== '__MACOSX')
  if (nonHidden.length === 1) {
    const innerDir = path.join(tmpDir, nonHidden[0])
    const st = await stat(innerDir)
    if (st.isDirectory()) {
      const innerEntries = await readdir(innerDir)
      for (const entry of innerEntries) {
        await rename(path.join(innerDir, entry), path.join(tmpDir, entry))
      }
      await rmdir(innerDir).catch(() => {})
    }
  }

  // Clean __MACOSX if present
  await rm(path.join(tmpDir, '__MACOSX'), { recursive: true, force: true }).catch(() => {})

  // Get all files recursively
  const allFiles = await getAllFiles(tmpDir)
  const siteFiles = allFiles.filter((f) => !f.startsWith('.'))

  // Upload each file to DO Spaces under site/{slug}/
  const s3Prefix = `site/${slug}`
  for (const relPath of siteFiles) {
    const filePath = path.join(tmpDir, relPath)
    const fileBuffer = await readFile(filePath)
    const key = `${s3Prefix}/${relPath}`
    await uploadToStorage(key, fileBuffer, getMimeType(relPath))
  }

  // Clean up temp directory
  await rm(tmpDir, { recursive: true, force: true })

  const fileCount = siteFiles.length
  const publicUrl = `${CDN_BASE}/${s3Prefix}/index.html`

  // Save to DB
  const site = await prisma.prospectSite.create({
    data: {
      label,
      slug,
      publicUrl,
      source: 'upload',
      fileCount,
      prospectId: id,
    },
  })

  return Response.json(site, { status: 201 })
}
