import express, { Router, type RequestHandler } from 'express'
import type { CvsController } from './cvs.controller.js'
import { CV_MAX_BYTES } from './cvs.schemas.js'

export function cvsRoutes(controller: CvsController, authenticate: RequestHandler): Router {
  const router = Router()
  router.use(authenticate)
  router.post('/', express.raw({ type: 'application/pdf', limit: CV_MAX_BYTES }), controller.upload)
  router.get('/active', controller.active)
  router.post('/:id/analysis', controller.retry)
  router.patch('/:id', controller.confirmRole)
  return router
}
