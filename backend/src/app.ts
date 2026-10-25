import express, { Router, type Express } from 'express'
import type { PrismaClient } from './generated/prisma/client.js'
import type { Batches } from './llm/batch.js'
import type { SendMessage, SendStream } from './llm/send.js'
import { createApplicationsModule } from './modules/applications/applications.module.js'
import { createAuthModule } from './modules/auth/auth.module.js'
import { createCoachModule } from './modules/coach/coach.module.js'
import { createCvsModule } from './modules/cvs/cvs.module.js'
import { createInterviewsModule } from './modules/interviews/interviews.module.js'
import type { BaClient } from './modules/jobs/jobs.ba.js'
import { createJobsModule } from './modules/jobs/jobs.module.js'
import { createMatchesModule } from './modules/matches/matches.module.js'
import { requireAuth } from './shared/auth.middleware.js'
import { errorHandler } from './shared/errors.js'

export type AppDeps = {
  prisma: PrismaClient
  tokenTtlDays: number
  sendStream: SendStream
  sendMessage: SendMessage
  batches: Batches
  ba: BaClient
}

export function createApp({ prisma, tokenTtlDays, sendStream, sendMessage, batches, ba }: AppDeps): Express {
  const app = express()
  app.use(express.json())

  const auth = createAuthModule({ prisma, tokenTtlDays })
  const authenticate = requireAuth(auth.service)
  const cvs = createCvsModule({ prisma, batches, authenticate })
  const jobs = createJobsModule({ prisma, ba, sendMessage, authenticate })
  const matches = createMatchesModule({ prisma, sendMessage, cvs: cvs.service, jobs: jobs.service, authenticate })
  const applications = createApplicationsModule({ prisma, jobs: jobs.service, matches: matches.service, authenticate })
  const coach = createCoachModule({
    prisma,
    sendStream,
    cvs: cvs.service,
    applications: applications.service,
    matches: matches.service,
    authenticate,
  })
  const interviews = createInterviewsModule({
    prisma,
    sendMessage,
    jobs: jobs.service,
    matches: matches.service,
    authenticate,
  })

  const api = Router()
  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  })
  api.use('/auth', auth.router)
  api.use('/coach', coach.router)
  api.use('/cvs', cvs.router)
  api.use('/jobs', jobs.router)
  api.use('/matches', matches.router)
  api.use('/applications', applications.router)
  api.use('/interviews', interviews.router)

  app.use('/api/v1', api)
  app.use(errorHandler)
  return app
}
