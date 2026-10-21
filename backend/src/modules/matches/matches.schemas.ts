import { z } from 'zod'
import type { CvRole } from '../../prompts/cv_analysis.js'
import type { MatchAnalysis } from '../../prompts/match_analysis.js'

export const matchQuerySchema = z.object({ job_id: z.coerce.number().int().positive() })

export const matchRunSchema = z.object({ job_id: z.int().positive() })

export type MatchOutput = {
  id: number
  job_id: number
  score: number
  fit: string
  strengths: MatchAnalysis['strengths']
  gaps: MatchAnalysis['gaps']
  tips: MatchAnalysis['tips']
  archived: boolean
  created_at: Date
  cv_version: { id: number; role: CvRole | null; created_at: Date }
}

export type MatchOverviewOutput = { current: MatchOutput | null; archived: MatchOutput[] }
