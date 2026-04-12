import prisma from '@/lib/prisma'
import { runSeedFromEnv } from '@/lib/initial-admin'

async function main() {
  await runSeedFromEnv()
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
