import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const MODEL = 'claude-sonnet-5-5'
export const EFFORTS = ['medium', 'high'] as const satisfies OutputConfig['effort'][]

export const THINKING = {
  normal: { type: 'between_tools' },
  extended: { type: 'adaptive' },
} as const satisfies Record<string, ThinkingConfigParam>

export const MAX_TOKENS = 8000

export const INPUT_BUDGET = 1000000 - MAX_TOKENS - 4000
export const TURN_BUDGET = 100000
export const STEPS_BUDGET = INPUT_BUDGET - TURN_BUDGET
export const HISTORY_TOKENS = 20000

export const TOOL_ROUNDS = 4
const APPLICATIONS_LIMIT = 50
export const RESEARCH_LIMIT = 3
export const RESEARCH_MAX_CHARS = 2000
export const RESEARCH_SOURCES = 5
const CV_SECTIONS = [
  'Zielrolle',
  'Stationen',
  'Kenntnisse',
  'Ausbildung',
  'Sprachen',
  'Stärken',
  'Schwächen',
  'Tipps',
] as const
export const APPLICATIONS_SIZES = [APPLICATIONS_LIMIT, 20, 5]
export const CV_SIZES = [
  CV_SECTIONS,
  ['Zielrolle', 'Stationen', 'Kenntnisse', 'Ausbildung', 'Sprachen'],
  ['Zielrolle', 'Stationen'],
] as const
