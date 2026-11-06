import { Router, type RequestHandler } from 'express'
import type { ResearchController } from './research.controller.js'

export function researchRoutes(controller: ResearchController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/conversations/:conversationId', controller.list)
  router.post('/conversations/:conversationId', controller.run)
  router.post('/:id/confirm', controller.confirm)
  return router
}
