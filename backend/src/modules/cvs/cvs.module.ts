import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Batches } from '../../llm/batch.js'
import { CvsController } from './cvs.controller.js'
import { cvsRoutes } from './cvs.routes.js'
import { CvsService } from './cvs.service.js'

export type CvsModuleDeps = { prisma: PrismaClient; batches: Batches; authenticate: RequestHandler }

export function createCvsModule(deps: CvsModuleDeps): { router: Router; service: CvsService } {
  const service = new CvsService(deps.prisma, deps.batches)
  const controller = new CvsController(service)
  const router = cvsRoutes(controller, deps.authenticate)
  return { router, service }
}
