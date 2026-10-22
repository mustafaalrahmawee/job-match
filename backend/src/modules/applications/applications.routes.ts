import { Router, type RequestHandler } from 'express'
import type { ApplicationsController } from './applications.controller.js'

export function applicationsRoutes(controller: ApplicationsController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.get('/', controller.list)
  router.post('/', controller.create)
  router.get('/:id', controller.show)
  router.patch('/:id', controller.setStatus)
  router.post('/:id/notes', controller.addNote)
  return router
}
