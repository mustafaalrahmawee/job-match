import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { Variant } from '../../llm/assemble.js'
import type { ApplicationStatus } from '../../modules/applications/applications.schemas.js'
import type { CompanyResearchSource } from '../company_research/company_research.schemas.js'
import type { CoachCv } from '../cv_analysis/cv_analysis.schemas.js'
import type { COACH_AGENT_EFFORTS, COACH_AGENT_THINKING } from './coach_agent.config.js'
import type { COACH_AGENT_ERRORS } from './coach_agent.texts.js'

export type Quality = keyof typeof COACH_AGENT_THINKING
export type Effort = (typeof COACH_AGENT_EFFORTS)[number]
export type ChatSettings = { quality: Quality; effort: Effort }
export type CoachVariant = Variant & { quality?: Quality }

export type CoachApplication = {
  id: number
  status: ApplicationStatus
  changedAt: Date
  job: { title: string; company: string | null; city: string }
}

export type CoachResearch = {
  company: string
  question: string
  content: string
  sources: CompanyResearchSource[]
  createdAt: Date
}

export type CoachAgentContext = {
  cv: Omit<CoachCv, 'asOf'> | null
  applications: CoachApplication[]
  researches: CoachResearch[]
  asOf: string
  markId: string
}

export type CoachToolError = keyof typeof COACH_AGENT_ERRORS

export type HistoryTurn = { role: MessageParam['role']; content: string }
