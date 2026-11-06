import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SendStream } from '../../llm/send.js'
import type { CoachService } from '../coach/coach.service.js'
import { ResearchController } from './research.controller.js'
import { researchRoutes } from './research.routes.js'
import { ResearchService } from './research.service.js'

export type ResearchModuleDeps = {
  prisma: PrismaClient
  sendStream: SendStream
  coach: CoachService
  authenticate: RequestHandler
}

export function createResearchModule(deps: ResearchModuleDeps): { router: Router; service: ResearchService } {
  const service = new ResearchService(deps.prisma, deps.sendStream, deps.coach)
  const controller = new ResearchController(service)
  const router = researchRoutes(controller, deps.authenticate)
  return { router, service }
}
