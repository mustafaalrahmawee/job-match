import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SendMessage } from '../../llm/send.js'
import type { CvsService } from '../cvs/cvs.service.js'
import type { JobsService } from '../jobs/jobs.service.js'
import { MatchesController } from './matches.controller.js'
import { matchesRoutes } from './matches.routes.js'
import { MatchesService } from './matches.service.js'

export type MatchesModuleDeps = {
  prisma: PrismaClient
  sendMessage: SendMessage
  cvs: CvsService
  jobs: JobsService
  authenticate: RequestHandler
}

export function createMatchesModule(deps: MatchesModuleDeps): { router: Router; service: MatchesService } {
  const service = new MatchesService(deps.prisma, deps.sendMessage, deps.cvs, deps.jobs)
  const controller = new MatchesController(service)
  const router = matchesRoutes(controller, deps.authenticate)
  return { router, service }
}
