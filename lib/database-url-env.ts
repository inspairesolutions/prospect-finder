/**
 * Normaliza DATABASE_URL para Prisma (trim, quita comillas envolventes del panel de hosting).
 */
export function normalizePostgresDatabaseUrl(raw: string | undefined): string | undefined {
  if (raw == null) return undefined
  let u = raw.trim()
  if (
    (u.startsWith('"') && u.endsWith('"')) ||
    (u.startsWith("'") && u.endsWith("'"))
  ) {
    u = u.slice(1, -1).trim()
  }
  return u.length ? u : undefined
}

export function assertPostgresDatabaseUrlForPrisma(): string {
  const u = normalizePostgresDatabaseUrl(process.env.DATABASE_URL)
  if (!u) {
    throw new Error(
      'DATABASE_URL está vacía o no definida. En DigitalOcean, vincula la variable de la base de datos al componente web (Run time) con el nombre DATABASE_URL.'
    )
  }
  if (!u.startsWith('postgresql://') && !u.startsWith('postgres://')) {
    throw new Error(
      'DATABASE_URL debe empezar por postgresql:// o postgres://. Revisa el valor en el panel (sin espacios raros al inicio; si copiaste la cadena entre comillas, quítalas del valor).'
    )
  }
  return u
}

/** Aplica la URL normalizada a process.env para @prisma/client y subprocesos. */
export function applyNormalizedDatabaseUrlToEnv(): void {
  const u = normalizePostgresDatabaseUrl(process.env.DATABASE_URL)
  if (u) process.env.DATABASE_URL = u
}
