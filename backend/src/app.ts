import express, { Router, type Express } from 'express'
import type { PrismaClient } from './generated/prisma/client.js'
import type { Batches } from './llm/batch.js'
import type { SendStream } from './llm/send.js'
import { createAuthModule } from './modules/auth/auth.module.js'
import { createCoachModule } from './modules/coach/coach.module.js'
import { createCvsModule } from './modules/cvs/cvs.module.js'
import { requireAuth } from './shared/auth.middleware.js'
import { errorHandler } from './shared/errors.js'

export type AppDeps = { prisma: PrismaClient; tokenTtlDays: number; send: SendStream; batches: Batches }

export function createApp({ prisma, tokenTtlDays, send, batches }: AppDeps): Express {
  const app = express()
  app.use(express.json())

  const auth = createAuthModule({ prisma, tokenTtlDays })
  const authenticate = requireAuth(auth.service)
  const coach = createCoachModule({ prisma, send, authenticate })
  const cvs = createCvsModule({ prisma, batches, authenticate })

  const api = Router()
  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  })
  api.use('/auth', auth.router)
  api.use('/coach', coach.router)
  api.use('/cvs', cvs.router)

  app.use('/api/v1', api)
  app.use(errorHandler)
  return app
}
