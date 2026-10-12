import type { Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { requireAuth } from '../../shared/auth.middleware.js'
import { AuthController } from './auth.controller.js'
import { authRoutes } from './auth.routes.js'
import { AuthService } from './auth.service.js'

export type AuthModuleDeps = { prisma: PrismaClient; tokenTtlDays: number }

export function createAuthModule(deps: AuthModuleDeps): { router: Router; service: AuthService } {
  const service = new AuthService(deps.prisma, deps.tokenTtlDays)
  const controller = new AuthController(service)
  const router = authRoutes(controller, requireAuth(service))
  return { router, service }
}
