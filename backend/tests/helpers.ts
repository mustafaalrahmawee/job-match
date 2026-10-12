import type { Express } from 'express'
import { afterAll, beforeEach } from 'vitest'
import { createApp } from '../src/app.js'
import { env } from '../src/config/env.js'
import type { PrismaClient, User } from '../src/generated/prisma/client.js'
import { AuthService } from '../src/modules/auth/auth.service.js'
import { createPrisma } from '../src/shared/prisma.js'

export const TOKEN_TTL_DAYS = 30

export function useTestDatabase(): { prisma: PrismaClient; app: Express; auth: AuthService } {
  const prisma = createPrisma(env.TEST_DATABASE_URL)
  const app = createApp({ prisma, tokenTtlDays: TOKEN_TTL_DAYS })
  const auth = new AuthService(prisma, TOKEN_TTL_DAYS)
  beforeEach(() => prisma.user.deleteMany())
  afterAll(() => prisma.$disconnect())
  return { prisma, app, auth }
}

export function createAnna(auth: AuthService): Promise<User> {
  return auth.createUser('anna@example.com', 'richtig-geheim')
}
