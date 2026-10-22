import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { JobsService } from '../jobs/jobs.service.js'
import type { MatchesService } from '../matches/matches.service.js'
import { ApplicationsController } from './applications.controller.js'
import { applicationsRoutes } from './applications.routes.js'
import { ApplicationsService } from './applications.service.js'

export type ApplicationsModuleDeps = {
  prisma: PrismaClient
  jobs: JobsService
  matches: MatchesService
  authenticate: RequestHandler
}

export function createApplicationsModule(deps: ApplicationsModuleDeps): { router: Router; service: ApplicationsService } {
  const service = new ApplicationsService(deps.prisma, deps.jobs, deps.matches)
  const controller = new ApplicationsController(service)
  const router = applicationsRoutes(controller, deps.authenticate)
  return { router, service }
}
