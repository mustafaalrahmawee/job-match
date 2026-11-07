import { z } from 'zod'
import { OFFER_TYPES, type JobDraft } from '../../modules/jobs/jobs.schemas.js'

export type JobExtractInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; mediaType: 'image/png' | 'image/jpeg'; data: string }

export type LineField = 'title' | 'company' | 'city' | 'salary'

export type JobExtractResult = {
  draft: JobDraft
  suspiciousText: string[]
  unverified: LineField[]
  hits: number
}

export const jobExtractSchema = z.object({
  is_job: z.boolean(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  city: z.string().nullable(),
  offer_type: z.enum(OFFER_TYPES).nullable(),
  full_time: z.boolean(),
  part_time: z.boolean(),
  salary: z.string().nullable(),
  text: z.string().nullable(),
  suspicious_text: z.array(z.string()),
})

export type JobExtract = z.infer<typeof jobExtractSchema>

export const JOB_EXTRACT_JSON_SCHEMA = z.toJSONSchema(jobExtractSchema)
