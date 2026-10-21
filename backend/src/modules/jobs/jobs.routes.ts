import express, { Router, type RequestHandler } from 'express'
import type { JobsController } from './jobs.controller.js'
import { JOB_IMAGE_MAX_BYTES } from './jobs.schemas.js'

export function jobsRoutes(controller: JobsController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/', controller.list)
  router.post('/', controller.create)
  router.post(
    '/extraction',
    express.raw({ type: ['image/png', 'image/jpeg'], limit: JOB_IMAGE_MAX_BYTES }),
    controller.extract,
  )
  router.get('/:id', controller.show)
  return router
}
