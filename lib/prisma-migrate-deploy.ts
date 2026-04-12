import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Aplica migraciones pendientes (no interactivo). Debe ejecutarse antes del seed
 * en una base de datos nueva.
 */
export async function runPrismaMigrateDeploy(): Promise<void> {
  const prismaBin = join(process.cwd(), 'node_modules', '.bin', 'prisma')
  if (!existsSync(prismaBin)) {
    throw new Error(
      'No se encontró Prisma CLI (node_modules). Ejecuta npm install en el proyecto.'
    )
  }

  try {
    const { stderr } = await execFileAsync(prismaBin, ['migrate', 'deploy'], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    })
    if (stderr?.trim()) {
      console.warn('[migrate deploy]', stderr)
    }
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string }
    const detail = (e.stderr || e.message || String(err)).trim()
    throw new Error(
      detail
        ? `Migraciones: ${detail}`
        : 'No se pudieron aplicar las migraciones. Comprueba DATABASE_URL y que PostgreSQL esté accesible.'
    )
  }
}
