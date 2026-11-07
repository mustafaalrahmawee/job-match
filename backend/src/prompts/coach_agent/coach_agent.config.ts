import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const COACH_AGENT_MODEL = 'claude-sonnet-5-5'
export const COACH_AGENT_EFFORTS = ['medium', 'high'] as const satisfies OutputConfig['effort'][]

export const COACH_AGENT_THINKING = {
  normal: { type: 'between_tools' },
  extended: { type: 'adaptive' },
} as const satisfies Record<string, ThinkingConfigParam>

export const COACH_AGENT_MAX_TOKENS = 8000

export const COACH_AGENT_INPUT_BUDGET = 1000000 - COACH_AGENT_MAX_TOKENS - 4000
export const COACH_AGENT_TURN_BUDGET = 100000
export const COACH_AGENT_STEPS_BUDGET = COACH_AGENT_INPUT_BUDGET - COACH_AGENT_TURN_BUDGET
export const COACH_AGENT_HISTORY_TOKENS = 20000

export const COACH_AGENT_TOOL_ROUNDS = 4
const COACH_AGENT_APPLICATIONS_LIMIT = 50
export const COACH_AGENT_RESEARCH_LIMIT = 3
export const COACH_AGENT_RESEARCH_MAX_CHARS = 2000
export const COACH_AGENT_RESEARCH_SOURCES = 5
const COACH_AGENT_CV_SECTIONS = [
  'Zielrolle',
  'Stationen',
  'Kenntnisse',
  'Ausbildung',
  'Sprachen',
  'Stärken',
  'Schwächen',
  'Tipps',
] as const
export const COACH_AGENT_APPLICATIONS_SIZES = [COACH_AGENT_APPLICATIONS_LIMIT, 20, 5]
export const COACH_AGENT_CV_SIZES = [
  COACH_AGENT_CV_SECTIONS,
  ['Zielrolle', 'Stationen', 'Kenntnisse', 'Ausbildung', 'Sprachen'],
  ['Zielrolle', 'Stationen'],
] as const

export const INVISIBLE_CHARS = /[\u{E0000}-\u{E007F}\u{200B}-\u{200D}\u{2060}]|[\u{FE00}-\u{FE0F}]/gu
