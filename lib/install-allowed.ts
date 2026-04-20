/**
 * Ruta /install solo activa si ALLOW_INSTALL=true.
 * En producción dejar en false o sin definir tras el primer despliegue.
 */
export function isInstallAllowed(): boolean {
  const raw = process.env.ALLOW_INSTALL
  if (!raw) return false

  const normalized = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}
