import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  applyNormalizedDatabaseUrlToEnv,
  assertPostgresDatabaseUrlForPrisma,
} from '@/lib/database-url-env'

const execFileAsync = promisify(execFile)

function resolvePrismaMigrateCommand(): { file: string; args: string[] } {
  const cwd = process.cwd()
  const script = join(cwd, 'node_modules', 'prisma', 'build', 'index.js')
  if (existsSync(script)) {
    return { file: process.execPath, args: [script, 'migrate', 'deploy'] }
  }
  const shim = join(cwd, 'node_modules', '.bin', 'prisma')
  if (existsSync(shim)) {
    return { file: shim, args: ['migrate', 'deploy'] }
  }
  throw new Error(
    'No se encontró Prisma CLI (paquete `prisma` en node_modules). En producción debe estar en `dependencies` (no solo devDependencies) y, con Docker standalone, copiarse en la imagen final.'
  )
}

/**
 * Aplica migraciones pendientes (no interactivo). Debe ejecutarse antes del seed
 * en una base de datos nueva.
 */
export async function runPrismaMigrateDeploy(): Promise<void> {
  applyNormalizedDatabaseUrlToEnv()
  const databaseUrl = assertPostgresDatabaseUrlForPrisma()
  const { file, args } = resolvePrismaMigrateCommand()

  try {
    const { stderr } = await execFileAsync(file, args, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
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
