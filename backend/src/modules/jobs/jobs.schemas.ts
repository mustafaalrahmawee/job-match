import { z } from 'zod'
import { CV_ROLES } from '../../prompts/cv_analysis.js'

export const OFFER_TYPES = ['work', 'self_employment', 'apprenticeship', 'internship'] as const

export const REGIONS = [
  'BADEN_WUERTTEMBERG',
  'BAYERN',
  'BERLIN',
  'BRANDENBURG',
  'BREMEN',
  'HAMBURG',
  'HESSEN',
  'MECKLENBURG_VORPOMMERN',
  'NIEDERSACHSEN',
  'NORDRHEIN_WESTFALEN',
  'RHEINLAND_PFALZ',
  'SAARLAND',
  'SACHSEN',
  'SACHSEN_ANHALT',
  'SCHLESWIG_HOLSTEIN',
  'THUERINGEN',
] as const

export type Region = (typeof REGIONS)[number]

export const baSearchPageSchema = z.object({
  ergebnisliste: z.array(z.unknown()).default([]),
})

export const baJobSchema = z.object({
  referenznummer: z.string().min(1).max(64),
  stellenangebotsTitel: z.string().min(1),
  firma: z.string().optional(),
  stellenangebotsart: z.enum(['ARBEIT', 'SELBSTAENDIGKEIT', 'AUSBILDUNG', 'PRAKTIKUM_TRAINEE']),
  stellenlokationen: z
    .array(
      z.object({
        adresse: z.object({ ort: z.string().optional(), region: z.string().optional(), land: z.string().optional() }),
      }),
    )
    .default([]),
  veroeffentlichungszeitraum: z.object({ von: z.iso.date() }),
  arbeitszeitVollzeit: z.boolean().default(false),
  arbeitszeitTeilzeitVormittag: z.boolean().default(false),
  arbeitszeitTeilzeitNachmittag: z.boolean().default(false),
  arbeitszeitTeilzeitAbend: z.boolean().default(false),
  arbeitszeitTeilzeitFlexibel: z.boolean().default(false),
})

export type BaJob = z.infer<typeof baJobSchema>

export const baDetailsSchema = z.object({
  stellenangebotsBeschreibung: z.string().trim().min(1),
})

export const JOBS_PAGE_SIZE = 20

export const jobIdSchema = z.coerce.number().int().positive()

export const jobsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(CV_ROLES).optional(),
  region: z.enum(REGIONS).optional(),
  work_time: z.enum(['full', 'part']).optional(),
  offer_type: z.enum(OFFER_TYPES).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(JOBS_PAGE_SIZE),
})

export type JobsQuery = z.infer<typeof jobsQuerySchema>

export const jobOutputSchema = z.object({
  id: z.int(),
  source: z.enum(['ba', 'own']),
  title: z.string(),
  company: z.string().nullable(),
  city: z.string(),
  region: z.enum(REGIONS).nullable(),
  offer_type: z.enum(OFFER_TYPES),
  role: z.enum(CV_ROLES),
  full_time: z.boolean(),
  part_time: z.boolean(),
  published_at: z.iso.date(),
})

export type JobOutput = z.infer<typeof jobOutputSchema>

export const jobDetailOutputSchema = jobOutputSchema.extend({ description: z.string(), url: z.url().nullable() })

export type JobDetailOutput = z.infer<typeof jobDetailOutputSchema>

export type JobListOutput = { total: number; pool_updated_at: Date | null; jobs: JobOutput[] }
