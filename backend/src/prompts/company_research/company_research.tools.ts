import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages'
import { COMPANY_RESEARCH_WEB_SEARCHES } from './company_research.config.js'

export const COMPANY_RESEARCH_TOOLS: ToolUnion[] = [
  {
    type: 'web_search_20260318',
    name: 'web_search',
    max_uses: COMPANY_RESEARCH_WEB_SEARCHES,
    allowed_callers: ['direct'],
    user_location: { type: 'approximate', country: 'DE' },
  },
]
