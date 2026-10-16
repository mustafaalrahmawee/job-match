import { z } from 'zod'
import { CV_ROLES, cvAnalysisSchema } from '../../prompts/cv_analysis.js'

export const CV_MAX_BYTES = 5 * 1024 * 1024

export const cvIdSchema = z.coerce.number().int().positive()

export const pdfSchema = z
  .instanceof(Buffer, { message: 'A PDF file is required' })
  .refine((pdf) => pdf.subarray(0, 5).toString('latin1') === '%PDF-', 'The file is not a PDF')

export const confirmRoleSchema = z.object({ role: z.enum(CV_ROLES) })

export type ConfirmRoleInput = z.infer<typeof confirmRoleSchema>

export const ANALYSIS_ERRORS = [
  'submit_failed',
  'batch_failed',
  'refused',
  'too_long',
  'invalid_output',
  'not_cv',
  'language',
] as const

export type AnalysisError = (typeof ANALYSIS_ERRORS)[number]

export const cvVersionSchema = z.object({
  id: z.int(),
  status: z.enum(['none', 'running', 'ready', 'failed']),
  error: z.enum(ANALYSIS_ERRORS).nullable(),
  role: z.enum(CV_ROLES).nullable(),
  analysis: cvAnalysisSchema.nullable(),
  created_at: z.date(),
})

export type CvVersionOutput = z.infer<typeof cvVersionSchema>
