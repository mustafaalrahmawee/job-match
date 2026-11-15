import { z } from 'zod'
import * as cvConfig from '../../prompts/cv_analysis/cv_analysis.config.js'
import type { JobOutput } from '../jobs/jobs.schemas.js'

const DAY_SECONDS = 86_400

const positiveInt = z.number().int().positive()

export function jobMetadataSchema(now: Date) {
  const tomorrow = Math.floor(Date.parse(now.toISOString().slice(0, 10)) / 1000) + DAY_SECONDS
  return z
    .strictObject({
      jobId: positiveInt,
      source: z.enum(['ba', 'own']),
      userId: positiveInt.optional(),
      role: z.enum(cvConfig.ROLES),
      publishedAt: z.number().int().multipleOf(DAY_SECONDS).max(tomorrow),
    })
    .refine((metadata) => (metadata.source === 'own') === (metadata.userId !== undefined), { path: ['userId'] })
}

export const cvMetadataSchema = z.strictObject({ cvVersionId: positiveInt, userId: positiveInt })

export type JobMetadata = z.infer<ReturnType<typeof jobMetadataSchema>>

export type CvMetadata = z.infer<typeof cvMetadataSchema>

export const searchQuerySchema = z.object({ role: z.enum(cvConfig.ROLES).optional() })

export type FitListOutput = { cv_version: { id: number; created_at: string }; jobs: JobOutput[] }
