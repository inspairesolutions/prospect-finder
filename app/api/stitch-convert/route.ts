import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, readFile, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import archiver from 'archiver'
import { Extract } from 'unzipper'
import { pipeline } from 'stream/promises'
import { convertStitchProject } from '@/lib/stitch-converter'

function createZipFromDir(sourceDir: string, outputFile: string, rootName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputFile)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sourceDir, rootName)
    archive.finalize()
  })
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('stitch_zip') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 })
  }

  if (!file.name.endsWith('.zip')) {
    return NextResponse.json({ error: 'Por favor sube un archivo .zip' }, { status: 400 })
  }

  const id = randomUUID()
  const tmpDir = join(tmpdir(), `stitch_${id}`)
  const outputDir = join(tmpdir(), `stitch_out_${id}`)
  const outputZip = join(tmpdir(), `stitch_converted_${id}.zip`)

  try {
    await mkdir(tmpDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    const zipPath = join(tmpDir, 'upload.zip')
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(zipPath, buffer)

    await pipeline(
      createReadStream(zipPath),
      Extract({ path: tmpDir })
    )

    await convertStitchProject(tmpDir, outputDir)

    const projectName = file.name.replace(/\.zip$/i, '')
    await createZipFromDir(outputDir, outputZip, `${projectName}_converted`)

    const zipBuffer = await readFile(outputZip)

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}_converted.zip"`,
      },
    })
  } catch (err) {
    console.error('Stitch conversion error:', err)
    return NextResponse.json(
      { error: 'Error durante la conversión: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    await rm(outputZip, { force: true }).catch(() => {})
  }
}
