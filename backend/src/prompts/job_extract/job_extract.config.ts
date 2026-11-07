import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const JOB_EXTRACT_MODEL = 'claude-haiku-5-5'
export const JOB_EXTRACT_EFFORT: OutputConfig['effort'] = 'medium'
export const JOB_EXTRACT_THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const JOB_EXTRACT_MAX_TOKENS = 16000
export const JOB_EXTRACT_INPUT_BUDGET = 1000000 - JOB_EXTRACT_MAX_TOKENS - 4000
export const JOB_EXTRACT_IMAGE_TOKENS = 5000

export const JOB_SUSPICIOUS_MAX_ENTRIES = 10
export const JOB_EXCERPT_MAX_CHARS = 1000

export const INVISIBLE_CHARS = /[\u{E0000}-\u{E007F}\u{200B}-\u{200D}\u{2060}]|[\u{FE00}-\u{FE0F}]/gu
