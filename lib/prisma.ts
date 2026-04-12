import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'

// Misma prioridad que `next dev` (.env.local sobre .env, etc.). Evita que Prisma use
// una DATABASE_URL distinta a la del resto de la app.
loadEnvConfig(process.cwd())

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
