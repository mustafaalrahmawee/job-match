import type { OutputConfig } from '@anthropic-ai/sdk/resources/messages'
import { z } from 'zod'
import type { JOB_SOURCES } from '../../modules/jobs/jobs.schemas.js'

export type Variant = { model?: string; effort?: OutputConfig['effort'] }

export type MatchJob = {
  source: (typeof JOB_SOURCES)[number]
  title: string
  company: string | null
  city: string
  description: string
}

const quote = z.string().refine((value) => value.trim() !== '')
const names = z.array(z.string())

export const matchAnalysisSchema = z.object({
  gaps: z.array(z.object({ ad_quote: quote, cv_quote: quote.nullable(), text: z.string(), names })),
  strengths: z.array(z.object({ ad_quote: quote.nullable(), cv_quote: quote, text: z.string(), names })),
  score: z.number().refine((score) => Number.isInteger(score) && score >= 0 && score <= 100),
  tips: z.array(
    z
      .object({ ad_quote: quote.nullable(), cv_quote: quote.nullable(), text: z.string() })
      .refine((tip) => tip.ad_quote !== null || tip.cv_quote !== null),
  ),
  suspicious_text: z.array(z.string()),
})

export const matchStoredAnalysisSchema = matchAnalysisSchema.omit({ suspicious_text: true })

export type MatchAnalysisOutput = z.infer<typeof matchAnalysisSchema>

export type MatchAnalysis = z.infer<typeof matchStoredAnalysisSchema>

export type CoachMatch = Pick<MatchAnalysis, 'score' | 'gaps' | 'strengths'> & { createdAt: Date }

export const MATCH_ANALYSIS_JSON_SCHEMA = z.toJSONSchema(matchAnalysisSchema)
