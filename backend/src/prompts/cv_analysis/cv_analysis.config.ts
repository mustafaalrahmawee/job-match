import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const MODEL = 'claude-haiku-5-5'
export const EFFORT: OutputConfig['effort'] = 'medium'
export const THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const MAX_TOKENS = 16000
export const INPUT_BUDGET = 1000000 - MAX_TOKENS - 4000

export const MAX_PAGES = 5
export const PDF_TOKENS = MAX_PAGES * 4500

export const ENTRY_MAX_CHARS = 300

export const ROLES = [
  'Frontend',
  'Backend',
  'Fullstack',
  'Mobile',
  'Data',
  'DevOps',
  'QA',
  'UX/UI',
  'IT-Support',
  'IT-Projektmanagement',
  'Andere',
] as const

export const SUSPICIOUS_KINDS = ['hidden_text', 'instruction', 'fake_notice'] as const

export const LIST_LIMITS = {
  positions: 15,
  skills: 30,
  education: 8,
  languages: 8,
  strengths: 5,
  weaknesses: 5,
  tips: 5,
} as const
