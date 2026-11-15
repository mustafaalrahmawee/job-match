import type { RequestHandler, Router } from 'express'
import type { CvsService } from '../cvs/cvs.service.js'
import type { JobsService } from '../jobs/jobs.service.js'
import { SearchController } from './search.controller.js'
import type { SearchIndex } from './search.index.js'
import { searchRoutes } from './search.routes.js'
import { SearchService } from './search.service.js'

export type SearchModuleDeps = {
  cvs: CvsService
  jobs: JobsService
  index: SearchIndex
  authenticate: RequestHandler
}

export function createSearchModule(deps: SearchModuleDeps): { router: Router; service: SearchService } {
  const service = new SearchService(deps.cvs, deps.jobs, deps.index)
  const controller = new SearchController(service)
  const router = searchRoutes(controller, deps.authenticate)
  return { router, service }
}
