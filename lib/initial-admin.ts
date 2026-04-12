import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export type SeedInstallState =
  | { kind: 'missing_env' }
  | { kind: 'installed' }
  | { kind: 'needs_seed' }

/**
 * Instalación = existe en DB el usuario cuyo email coincide con SEED_ADMIN_EMAIL (.env).
 */
export async function getSeedInstallState(): Promise<SeedInstallState> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim()
  if (!email) {
    return { kind: 'missing_env' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    return { kind: 'installed' }
  }

  return { kind: 'needs_seed' }
}

/**
 * Misma lógica que el seed de Prisma: lee SEED_* del entorno y hace upsert del admin.
 */
export async function runSeedFromEnv(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim()
  const name = process.env.SEED_ADMIN_NAME?.trim()
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !name || !password) {
    throw new Error(
      'Configura SEED_ADMIN_EMAIL, SEED_ADMIN_NAME y SEED_ADMIN_PASSWORD en .env (ver .env.example).'
    )
  }

  if (password.length < 6) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 6 caracteres.')
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash,
      role: 'ADMIN',
    },
  })

  console.log(`Admin user ensured: ${admin.email}`)
}
