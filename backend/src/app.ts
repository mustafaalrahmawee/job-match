import express, { Router, type Express } from 'express'
import type { PrismaClient } from './generated/prisma/client.js'
import { createAuthModule } from './modules/auth/auth.module.js'
import { errorHandler } from './shared/errors.js'

export type AppDeps = { prisma: PrismaClient; tokenTtlDays: number }

export function createApp({ prisma, tokenTtlDays }: AppDeps): Express {
  const app = express()
  app.use(express.json())

  const auth = createAuthModule({ prisma, tokenTtlDays })

  const api = Router()
  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  })
  api.use('/auth', auth.router)

  app.use('/api/v1', api)
  app.use(errorHandler)
  return app
}
