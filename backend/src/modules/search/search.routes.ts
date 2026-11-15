import { Router, type RequestHandler } from 'express'
import type { SearchController } from './search.controller.js'

export function searchRoutes(controller: SearchController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/jobs', controller.list)
  return router
}
