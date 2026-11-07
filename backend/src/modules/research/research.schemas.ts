import { z } from 'zod'
import { visible } from '../../llm/untrusted.js'
import * as researchConfig from '../../prompts/company_research/company_research.config.js'
import type { CompanyResearchSource } from '../../prompts/company_research/company_research.schemas.js'

const field = z
  .string()
  .transform((text) => visible(text).trim())
  .pipe(z.string().min(1).max(researchConfig.FIELD_MAX_CHARS))

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
