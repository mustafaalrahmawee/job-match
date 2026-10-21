import type { RequestHandler } from 'express'
import type { CvRole } from '../../prompts/cv_analysis.js'
import { MATCH_SCORE_BANDS, type MatchAnalysis } from '../../prompts/match_analysis.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  matchJobIdSchema,
  matchRunSchema,
  type MatchListItemOutput,
  type MatchOutput,
  type MatchOverviewOutput,
} from './matches.schemas.js'
import type { MatchesService, MatchResultInfo } from './matches.service.js'

export class MatchesController {
  constructor(private readonly matches: MatchesService) { }

  list: RequestHandler = async (req, res) => {
    const results = await this.matches.list(authOf(req).user.id)
    const body: MatchListItemOutput[] = results.map((result) => ({
      ...output(result),
      job: {
        id: result.job.id,
        source: result.job.source,
        title: result.job.title,
        company: result.job.company,
        city: result.job.city,
      },
    }))
    res.json(body)
  }

  show: RequestHandler = async (req, res) => {
    const jobId = matchJobIdSchema.parse(req.params.jobId)
    const { current, archived } = await this.matches.overview(authOf(req).user.id, jobId)
    const body: MatchOverviewOutput = { current: current && output(current), archived: archived.map(output) }
    res.json(body)
  }

  run: RequestHandler = async (req, res) => {
    const { job_id } = matchRunSchema.parse(req.body)
    const result = await this.matches.run(authOf(req).user.id, job_id)
    res.status(201).json(output(result))
  }
}

function output(result: MatchResultInfo): MatchOutput {
  return {
    id: result.id,
    job_id: result.jobId,
    score: result.score,
    fit: MATCH_SCORE_BANDS.filter((band) => result.score >= band.min)[0].fit,
    strengths: result.strengths as MatchAnalysis['strengths'],
    gaps: result.gaps as MatchAnalysis['gaps'],
    tips: result.tips as MatchAnalysis['tips'],
    archived: !result.cvVersion.isActive,
    created_at: result.createdAt,
    cv_version: {
      id: result.cvVersionId,
      role: result.cvVersion.role as CvRole | null,
      created_at: result.cvVersion.createdAt,
    },
  }
}
