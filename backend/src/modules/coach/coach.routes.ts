import { Router, type RequestHandler } from 'express'
import type { CoachController } from './coach.controller.js'

export function coachRoutes(controller: CoachController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.post('/conversations', controller.create)
  router.get('/conversations/:id', controller.show)
  router.post('/conversations/:id/messages', controller.sendMessage)
  router.post('/conversations/:id/retry', controller.retry)
  return router
}
