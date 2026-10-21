import { Router, type RequestHandler } from 'express'
import type { MatchesController } from './matches.controller.js'

export function matchesRoutes(controller: MatchesController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/', controller.list)
  router.post('/', controller.run)
  router.get('/jobs/:jobId', controller.show)
  return router
}
