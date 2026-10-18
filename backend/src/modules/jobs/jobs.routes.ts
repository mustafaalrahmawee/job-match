import { Router, type RequestHandler } from 'express'
import type { JobsController } from './jobs.controller.js'

export function jobsRoutes(controller: JobsController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/', controller.list)
  router.get('/:id', controller.show)
  return router
}
