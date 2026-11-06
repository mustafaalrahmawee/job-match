import { z } from 'zod'
import { COMPANY_RESEARCH_FIELD_MAX_CHARS, type CompanyResearchSource } from '../../prompts/company_research.js'

const INVISIBLE_CHARS = /[\u{E0000}-\u{E007F}\u{200B}-\u{200D}\u{2060}]|[\u{FE00}-\u{FE0F}]/gu

const field = z
  .string()
  .transform((text) => text.replace(INVISIBLE_CHARS, '').trim())
  .pipe(z.string().min(1).max(COMPANY_RESEARCH_FIELD_MAX_CHARS))

export const researchConversationIdSchema = z.coerce.number().int().positive()

export const researchIdSchema = z.coerce.number().int().positive()

export const researchInputSchema = z.object({ company: field, question: field })

export type ResearchStep = { kind: 'web_search'; query: string; sources: number | null }

export type ResearchOutcome = 'ready' | 'empty' | 'unfinished' | 'stopped' | 'refused'

export type ResearchOutput = {
  id: number
  conversation_id: number
  company: string
  question: string
  text: string
  steps: ResearchStep[]
  sources: CompanyResearchSource[]
  suspicious_text: string | null
  suspicious_sources: CompanyResearchSource[]
  confirmed_at: Date | null
  created_at: Date
}
