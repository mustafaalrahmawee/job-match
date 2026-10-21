import type { RequestHandler, Router } from 'express'
import type { PrismaClient } from '../../generated/prisma/client.js'
import type { SendMessage } from '../../llm/send.js'
import { JobsController } from './jobs.controller.js'
import type { BaClient } from './jobs.ba.js'
import { jobsRoutes } from './jobs.routes.js'
import { JobsService } from './jobs.service.js'

export type JobsModuleDeps = {
  prisma: PrismaClient
  ba: BaClient
  sendMessage: SendMessage
  authenticate: RequestHandler
}

export function createJobsModule(deps: JobsModuleDeps): { router: Router; service: JobsService } {
  const service = new JobsService(deps.prisma, deps.ba, deps.sendMessage)
  const controller = new JobsController(service)
  const router = jobsRoutes(controller, deps.authenticate)
  return { router, service }
}
