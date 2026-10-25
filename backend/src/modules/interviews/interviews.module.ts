import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SendMessage } from '../../llm/send.js'
import type { JobsService } from '../jobs/jobs.service.js'
import type { MatchesService } from '../matches/matches.service.js'
import { InterviewsController } from './interviews.controller.js'
import { interviewsRoutes } from './interviews.routes.js'
import { InterviewsService } from './interviews.service.js'

export type InterviewsModuleDeps = {
  prisma: PrismaClient
  sendMessage: SendMessage
  jobs: JobsService
  matches: MatchesService
  authenticate: RequestHandler
}

export function createInterviewsModule(deps: InterviewsModuleDeps): { router: Router; service: InterviewsService } {
  const service = new InterviewsService(deps.prisma, deps.sendMessage, deps.jobs, deps.matches)
  const controller = new InterviewsController(service)
  const router = interviewsRoutes(controller, deps.authenticate)
  return { router, service }
}
