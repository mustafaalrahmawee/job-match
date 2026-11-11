import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const MODEL = 'claude-haiku-5-5'
export const EFFORT: OutputConfig['effort'] = 'medium'
export const THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const MAX_TOKENS = 16000

