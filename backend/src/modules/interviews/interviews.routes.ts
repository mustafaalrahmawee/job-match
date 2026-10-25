import { Router, type RequestHandler } from 'express'
import type { InterviewsController } from './interviews.controller.js'

export function interviewsRoutes(controller: InterviewsController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/', controller.list)
  router.post('/', controller.start)
  router.get('/:id', controller.show)
  router.post('/:id/answer', controller.answer)
  router.post('/:id/skip', controller.skip)
  router.post('/:id/continue', controller.resume)
  return router
}
