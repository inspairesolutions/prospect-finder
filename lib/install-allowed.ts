/**
 * Ruta /install solo activa si ALLOW_INSTALL=true.
 * En producción dejar en false o sin definir tras el primer despliegue.
 */
export function isInstallAllowed(): boolean {
  return process.env.ALLOW_INSTALL?.trim().toLowerCase() === 'true'
}
