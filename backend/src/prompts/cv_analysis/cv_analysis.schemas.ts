import { z } from 'zod'
import * as config from './cv_analysis.config.js'

export type CvRole = (typeof config.ROLES)[number]

export type CoachCv = { role: CvRole; analysis: CvAnalysis; asOf: string }

export const cvAnalysisSchema = z.object({
  is_cv: z.boolean(),
  language: z.string(),
  positions: z.array(
    z.object({
      employer: z.string().nullable(),
      title: z.string().nullable(),
      start: z.string().nullable(),
      ongoing: z.boolean(),
      end: z.string().nullable(),
    }),
  ),
  skills: z.array(z.string()),
  education: z.array(
    z.object({
      degree: z.string().nullable(),
      institution: z.string().nullable(),
      year: z.string().nullable(),
    }),
  ),
  highest_degree: z.string().nullable(),
  languages: z.array(z.object({ name: z.string(), level: z.string().nullable() })),
  suggested_role: z.enum(config.ROLES),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tips: z.array(z.string()),
  suspicious_text: z.array(z.object({ kind: z.enum(config.SUSPICIOUS_KINDS), excerpt: z.string() })),
})

export const cvStoredAnalysisSchema = cvAnalysisSchema.omit({ suspicious_text: true })

export type CvAnalysisOutput = z.infer<typeof cvAnalysisSchema>

export type CvAnalysis = z.infer<typeof cvStoredAnalysisSchema>

export type SuspiciousText = CvAnalysisOutput['suspicious_text']

export const JSON_SCHEMA = z.toJSONSchema(cvAnalysisSchema)
