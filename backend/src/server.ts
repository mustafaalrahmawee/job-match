import { createApp } from './app.js'
import { env } from './config/env.js'
import { createBatches } from './llm/batch.js'
import { createClaudeClient } from './llm/clients.js'
import { createSendStream } from './llm/send.js'
import { BaClient } from './modules/jobs/jobs.ba.js'
import { createPrisma } from './shared/prisma.js'

const claude = createClaudeClient()

const app = createApp({
  prisma: createPrisma(env.DATABASE_URL),
  tokenTtlDays: env.TOKEN_TTL_DAYS,
  send: createSendStream(claude),
  batches: createBatches(claude),
  ba: new BaClient(fetch),
})

app.listen(env.PORT, () => console.log(`job-match backend listening on port ${env.PORT}`))
