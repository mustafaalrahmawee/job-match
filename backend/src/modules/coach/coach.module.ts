import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SendStream } from '../../llm/send.js'
import type { ApplicationsService } from '../applications/applications.service.js'
import type { CvsService } from '../cvs/cvs.service.js'
import type { MatchesService } from '../matches/matches.service.js'
import { CoachController } from './coach.controller.js'
import { coachRoutes } from './coach.routes.js'
import { CoachService } from './coach.service.js'

export type CoachModuleDeps = {
  prisma: PrismaClient
  sendStream: SendStream
  cvs: CvsService
  applications: ApplicationsService
  matches: MatchesService
  authenticate: RequestHandler
}

export function createCoachModule(deps: CoachModuleDeps): { router: Router; service: CoachService } {
  const service = new CoachService(deps.prisma, deps.sendStream, deps.cvs, deps.applications, deps.matches)
  const controller = new CoachController(service)
  const router = coachRoutes(controller, deps.authenticate)
  return { router, service }
}
