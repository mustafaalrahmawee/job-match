import type { RequestHandler } from 'express'
import type { CvRole } from '../../prompts/cv_analysis/cv_analysis.schemas.js'
import { MATCH_SCORE_BANDS } from '../../prompts/match_analysis/match_analysis.config.js'
import type { MatchAnalysis } from '../../prompts/match_analysis/match_analysis.schemas.js'
import { authOf } from '../../shared/auth.middleware.js'
import {
  matchConfirmSchema,
  matchIdSchema,
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

  confirm: RequestHandler = async (req, res) => {
    const id = matchIdSchema.parse(req.params.id)
    const { created_at } = matchConfirmSchema.parse(req.body)
    const result = await this.matches.confirm(authOf(req).user.id, id, created_at)
    res.json(output(result))
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
    suspicious_text: (result.suspiciousText ?? []) as string[],
    confirmed_at: result.confirmedAt,
    archived: !result.cvVersion.isActive,
    created_at: result.createdAt,
    cv_version: {
      id: result.cvVersionId,
      role: result.cvVersion.role as CvRole | null,
      created_at: result.cvVersion.createdAt,
    },
  }
}
