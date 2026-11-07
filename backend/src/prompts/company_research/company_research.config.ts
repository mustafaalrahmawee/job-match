import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const MODEL = 'claude-haiku-5-5'
export const EFFORT: OutputConfig['effort'] = 'medium'
export const THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const MAX_TOKENS = 16000
const HITS_TOKENS = 25000
export const INPUT_BUDGET = 1000000 - MAX_TOKENS - 4000 - HITS_TOKENS

export const WEB_SEARCHES = 3
export const CONTINUATIONS = 2
export const FIELD_MAX_CHARS = 300
export const TITLE_MAX_CHARS = 200

export const ANSWER_TAG = 'antwort'
export const FLAG_TAG = 'meldung'
