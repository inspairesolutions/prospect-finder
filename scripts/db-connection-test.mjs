import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const prisma = new PrismaClient()

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL no está definida en el entorno (.env).')
    process.exit(1)
  }

  await prisma.$connect()
  const rows = await prisma.$queryRaw`SELECT version() AS version`
  const version = rows[0]?.version ?? '(sin resultado)'
  console.log('Conexión OK.')
  console.log('PostgreSQL:', version)
}

main()
  .catch((err) => {
    console.error('Error de conexión a la base de datos:')
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
