import { env } from '../../config/env.js'
import { createClaudeClient } from '../../llm/clients.js'
import { createSendMessage } from '../../llm/send.js'
import { createPrisma } from '../../shared/prisma.js'
import { AuthService } from '../auth/auth.service.js'
import { CvsService } from '../cvs/cvs.service.js'
import { createSearchIndex } from '../search/search.index.js'
import { SearchSync } from '../search/search.sync.js'
import { BaClient } from './jobs.ba.js'
import { JobsService } from './jobs.service.js'

const prisma = createPrisma(env.DATABASE_URL)
try {
  const index = createSearchIndex(env.CHROMA_URL, env.OLLAMA_URL)
  const sendMessage = createSendMessage(createClaudeClient())
  const service = new JobsService(prisma, new BaClient(fetch), sendMessage, index)
  const { imported, duplicates, filtered, failed } = await service.importPool()
  console.log(`imported ${imported}, duplicates ${duplicates}, filtered ${filtered}, failed ${failed}`)
  const sync = new SearchSync(new AuthService(prisma, env.TOKEN_TTL_DAYS), new CvsService(prisma, sendMessage, index), service, index)
  if (!(await sync.run())) process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
