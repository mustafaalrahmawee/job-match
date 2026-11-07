import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const CV_ANALYSIS_MODEL = 'claude-haiku-5-5'
export const CV_ANALYSIS_EFFORT: OutputConfig['effort'] = 'medium'
export const CV_ANALYSIS_THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const CV_ANALYSIS_MAX_TOKENS = 16000
export const CV_ANALYSIS_INPUT_BUDGET = 1000000 - CV_ANALYSIS_MAX_TOKENS - 4000

export const CV_MAX_PAGES = 5
export const CV_ANALYSIS_PDF_TOKENS = CV_MAX_PAGES * 4500

export const CV_ENTRY_MAX_CHARS = 300

export const CV_ROLES = [
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

export const CV_SUSPICIOUS_KINDS = ['hidden_text', 'instruction', 'fake_notice'] as const

export const CV_LIST_LIMITS = {
  positions: 15,
  skills: 30,
  education: 8,
  languages: 8,
  strengths: 5,
  weaknesses: 5,
  tips: 5,
} as const
