import { z } from 'zod'
import * as cvConfig from '../../prompts/cv_analysis/cv_analysis.config.js'
import type { CvAnalysis, CvRole } from '../../prompts/cv_analysis/cv_analysis.schemas.js'

export const CV_MAX_BYTES = 5 * 1024 * 1024

export const cvIdSchema = z.coerce.number().int().positive()

export const pdfSchema = z
  .instanceof(Buffer, { message: 'A PDF file is required' })
  .refine((pdf) => pdf.subarray(0, 5).toString('latin1') === '%PDF-', 'The file is not a PDF')

export const confirmRoleSchema = z.object({ role: z.enum(cvConfig.ROLES) })

export type AnalysisError =
  | 'unavailable'
  | 'timeout'
  | 'refused'
  | 'too_long'
  | 'invalid_output'
  | 'not_cv'
  | 'language'

export type CvVersionSummary = {
  id: number
  status: 'none' | 'running' | 'ready' | 'failed'
  error: AnalysisError | null
  role: CvRole | null
  active: boolean
  created_at: Date
}

export type CvVersionOutput = Omit<CvVersionSummary, 'active'> & { analysis: CvAnalysis | null }
