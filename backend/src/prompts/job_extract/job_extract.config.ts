import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const JOB_EXTRACT_MODEL = 'claude-haiku-5-5'
export const JOB_EXTRACT_EFFORT: OutputConfig['effort'] = 'medium'
export const JOB_EXTRACT_THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const JOB_EXTRACT_MAX_TOKENS = 16000
export const JOB_EXTRACT_INPUT_BUDGET = 1000000 - JOB_EXTRACT_MAX_TOKENS - 4000
export const JOB_EXTRACT_IMAGE_TOKENS = 5000

