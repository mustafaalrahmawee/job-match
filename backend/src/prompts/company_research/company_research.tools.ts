import type { ToolUnion } from '@anthropic-ai/sdk/resources/messages'
import * as config from './company_research.config.js'

export const TOOLS: ToolUnion[] = [
  {
    type: 'web_search_20260318',
    name: 'web_search',
    max_uses: config.WEB_SEARCHES,
    allowed_callers: ['direct'],
    user_location: { type: 'approximate', country: 'DE' },
  },
]
