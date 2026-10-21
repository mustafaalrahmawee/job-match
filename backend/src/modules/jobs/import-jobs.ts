import { env } from '../../config/env.js'
import { createClaudeClient } from '../../llm/clients.js'
import { createSendMessage } from '../../llm/send.js'
import { createPrisma } from '../../shared/prisma.js'
import { BaClient } from './jobs.ba.js'
import { JobsService } from './jobs.service.js'

const prisma = createPrisma(env.DATABASE_URL)
try {
  const service = new JobsService(prisma, new BaClient(fetch), createSendMessage(createClaudeClient()))
  const { imported, duplicates, filtered, failed } = await service.importPool()
  console.log(`imported ${imported}, duplicates ${duplicates}, filtered ${filtered}, failed ${failed}`)
} finally {
  await prisma.$disconnect()
}
