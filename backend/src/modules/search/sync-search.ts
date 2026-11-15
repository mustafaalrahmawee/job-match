import { env } from '../../config/env.js'
import { createClaudeClient } from '../../llm/clients.js'
import { createSendMessage } from '../../llm/send.js'
import { createPrisma } from '../../shared/prisma.js'
import { AuthService } from '../auth/auth.service.js'
import { CvsService } from '../cvs/cvs.service.js'
import { BaClient } from '../jobs/jobs.ba.js'
import { JobsService } from '../jobs/jobs.service.js'
import { createSearchIndex } from './search.index.js'
import { SearchSync } from './search.sync.js'

const prisma = createPrisma(env.DATABASE_URL)
try {
  const index = createSearchIndex(env.CHROMA_URL, env.OLLAMA_URL)
  const sendMessage = createSendMessage(createClaudeClient())
  const sync = new SearchSync(
    new AuthService(prisma, env.TOKEN_TTL_DAYS),
    new CvsService(prisma, sendMessage, index),
    new JobsService(prisma, new BaClient(fetch), sendMessage, index),
    index,
  )
  if (!(await sync.run())) process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
