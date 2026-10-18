import { env } from '../../config/env.js'
import { createPrisma } from '../../shared/prisma.js'
import { BaClient } from './jobs.ba.js'
import { JobsService } from './jobs.service.js'

const prisma = createPrisma(env.DATABASE_URL)
try {
  const { imported, duplicates, filtered, failed } = await new JobsService(prisma, new BaClient(fetch)).importPool()
  console.log(`imported ${imported}, duplicates ${duplicates}, filtered ${filtered}, failed ${failed}`)
} finally {
  await prisma.$disconnect()
}
