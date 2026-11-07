import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const COMPANY_RESEARCH_MODEL = 'claude-haiku-5-5'
export const COMPANY_RESEARCH_EFFORT: OutputConfig['effort'] = 'medium'
export const COMPANY_RESEARCH_THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const COMPANY_RESEARCH_MAX_TOKENS = 16000
const COMPANY_RESEARCH_HITS_TOKENS = 25000
export const COMPANY_RESEARCH_INPUT_BUDGET = 1000000 - COMPANY_RESEARCH_MAX_TOKENS - 4000 - COMPANY_RESEARCH_HITS_TOKENS

export const COMPANY_RESEARCH_WEB_SEARCHES = 3
export const COMPANY_RESEARCH_CONTINUATIONS = 2
export const COMPANY_RESEARCH_FIELD_MAX_CHARS = 300
export const COMPANY_RESEARCH_TITLE_MAX_CHARS = 200

export const COMPANY_RESEARCH_ANSWER_TAG = 'antwort'
export const COMPANY_RESEARCH_FLAG_TAG = 'meldung'
