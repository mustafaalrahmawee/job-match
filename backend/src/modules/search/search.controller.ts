import type { RequestHandler } from 'express'
import { authOf } from '../../shared/auth.middleware.js'
import { AppError } from '../../shared/errors.js'
import { output } from '../jobs/jobs.controller.js'
import { searchQuerySchema, type FitListOutput } from './search.schemas.js'
import type { SearchService } from './search.service.js'

export class SearchController {
  constructor(private readonly search: SearchService) { }

  list: RequestHandler = async (req, res) => {
    const { role } = searchQuerySchema.parse(req.query)
    const list = await this.search.list(authOf(req).user.id, role)
    if (list.result !== 'ok') throw new AppError(409, list.result)
    const body: FitListOutput = {
      cv_version: { id: list.version.id, created_at: list.version.createdAt.toISOString() },
      jobs: list.jobs.map(output),
    }
    res.json(body)
  }
}
