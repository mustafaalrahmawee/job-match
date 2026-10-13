import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SendStream } from '../../llm/send.js'
import { CoachController } from './coach.controller.js'
import { coachRoutes } from './coach.routes.js'
import { CoachService } from './coach.service.js'

export type CoachModuleDeps = { prisma: PrismaClient; send: SendStream; authenticate: RequestHandler }

export function createCoachModule(deps: CoachModuleDeps): { router: Router; service: CoachService } {
  const service = new CoachService(deps.prisma, deps.send)
  const controller = new CoachController(service)
  const router = coachRoutes(controller, deps.authenticate)
  return { router, service }
}
