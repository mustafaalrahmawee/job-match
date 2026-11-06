import type { OutputConfig, ToolUnion } from '@anthropic-ai/sdk/resources/messages'

export const COMPANY_RESEARCH_MODEL = 'claude-haiku-5-5'
export const COMPANY_RESEARCH_EFFORT: OutputConfig['effort'] = 'medium'
export const COMPANY_RESEARCH_WEB_SEARCHES = 3

export type CompanyResearchInput = { company: string; question: string }

export const COMPANY_RESEARCH_TOOLS: ToolUnion[] = [
  {
    type: 'web_search_20260318',
    name: 'web_search',
    max_uses: COMPANY_RESEARCH_WEB_SEARCHES,
    allowed_callers: ['direct'],
    user_location: { type: 'approximate', country: 'DE' },
  },
]
