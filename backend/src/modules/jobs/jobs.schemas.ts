import { z } from 'zod'
import { CV_ROLES } from '../../prompts/cv_analysis.js'

export const OFFER_TYPES = ['work', 'self_employment', 'apprenticeship', 'internship'] as const

export const JOB_SOURCES = ['ba', 'own'] as const

export const JOB_TEXT_MAX_CHARS = 20000

export const JOB_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export const JOB_LIMITS = { title: 300, company: 300, city: 200, salary: 200 } as const

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

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
  source: z.enum(JOB_SOURCES).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(JOBS_PAGE_SIZE),
})

export type JobsQuery = z.infer<typeof jobsQuerySchema>

export const extractTextSchema = z.object({ text: z.string().trim().min(1).max(JOB_TEXT_MAX_CHARS) })

export const screenshotSchema = z
  .instanceof(Buffer, { message: 'A PNG or JPEG file is required' })
  .transform((data, ctx) => {
    const mediaType = data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
      ? ('image/png' as const)
      : data.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)
        ? ('image/jpeg' as const)
        : null
    if (!mediaType) {
      ctx.addIssue({ code: 'custom', message: 'The file is not a PNG or JPEG image' })
      return z.NEVER
    }
    return { kind: 'image' as const, mediaType, data: data.toString('base64') }
  })

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null)

export const ownJobSchema = z.object({
  title: z.string().trim().min(1).max(JOB_LIMITS.title),
  company: optionalText(JOB_LIMITS.company),
  city: z.string().trim().min(1).max(JOB_LIMITS.city),
  offer_type: z.enum(OFFER_TYPES),
  full_time: z.boolean(),
  part_time: z.boolean(),
  salary: optionalText(JOB_LIMITS.salary),
  description: z.string().trim().min(1).max(JOB_TEXT_MAX_CHARS),
})

export type OwnJobInput = z.infer<typeof ownJobSchema>

export const jobDraftSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  city: z.string().nullable(),
  offer_type: z.enum(OFFER_TYPES),
  full_time: z.boolean(),
  part_time: z.boolean(),
  salary: z.string().nullable(),
  description: z.string(),
})

export type JobDraft = z.infer<typeof jobDraftSchema>

export const jobOutputSchema = z.object({
  id: z.int(),
  source: z.enum(JOB_SOURCES),
  title: z.string(),
  company: z.string().nullable(),
  city: z.string(),
  region: z.enum(REGIONS).nullable(),
  offer_type: z.enum(OFFER_TYPES),
  role: z.enum(CV_ROLES).nullable(),
  full_time: z.boolean(),
  part_time: z.boolean(),
  published_at: z.iso.date(),
})

export type JobOutput = z.infer<typeof jobOutputSchema>

export const jobDetailOutputSchema = jobOutputSchema.extend({
  description: z.string(),
  salary: z.string().nullable(),
  url: z.url().nullable(),
})

export type JobDetailOutput = z.infer<typeof jobDetailOutputSchema>

export type JobListOutput = { total: number; pool_updated_at: Date | null; jobs: JobOutput[] }
