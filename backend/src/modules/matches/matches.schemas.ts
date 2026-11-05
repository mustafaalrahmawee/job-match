import { z } from 'zod'
import type { CvRole } from '../../prompts/cv_analysis.js'
import type { MatchAnalysis } from '../../prompts/match_analysis.js'
import type { JOB_SOURCES } from '../jobs/jobs.schemas.js'

export const matchJobIdSchema = z.coerce.number().int().positive()

export const matchIdSchema = z.coerce.number().int().positive()

export const matchRunSchema = z.object({ job_id: z.int().positive() })

export const matchConfirmSchema = z.object({ created_at: z.coerce.date() })

export type MatchOutput = {
  id: number
  job_id: number
  score: number
  fit: string
  strengths: MatchAnalysis['strengths']
  gaps: MatchAnalysis['gaps']
  tips: MatchAnalysis['tips']
  suspicious_text: string[]
  confirmed_at: Date | null
  archived: boolean
  created_at: Date
  cv_version: { id: number; role: CvRole | null; created_at: Date }
}

export type MatchOverviewOutput = { current: MatchOutput | null; archived: MatchOutput[] }

export type MatchListItemOutput = MatchOutput & {
  job: { id: number; source: (typeof JOB_SOURCES)[number]; title: string; company: string | null; city: string }
}
