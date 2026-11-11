import type { OutputConfig, ThinkingConfigParam } from '@anthropic-ai/sdk/resources/messages'

export const MODEL = 'claude-sonnet-5-5'
export const EFFORT: OutputConfig['effort'] = 'medium'
export const THINKING: ThinkingConfigParam = { type: 'adaptive' }
export const MAX_TOKENS = 16000

export const CV_SECTIONS = ['Stationen', 'Kenntnisse', 'Ausbildung', 'Sprachen', 'Stärken'] as const

export const LIST_LIMITS = { gaps: 5, strengths: 5, tips: 3 } as const

export const ENTRY_MAX_CHARS = 300
export const ENTRY_MAX_NAMES = 8
export const NAME_MAX_CHARS = 100

export const SCORE_BANDS = [
  {
    min: 80,
    max: 100,
    fit: 'Sehr gute Passung',
    description: 'Der Lebenslauf belegt alle verlangten Anforderungen; offen ist höchstens Gewünschtes.',
  },
  {
    min: 55,
    max: 79,
    fit: 'Gute Passung',
    description:
      'Der Werdegang liegt im Berufsfeld der Stelle und belegt ihren Kern, aber einzelne verlangte Anforderungen fehlen oder sind nur teilweise belegt.',
  },
  {
    min: 25,
    max: 54,
    fit: 'Geringe Passung',
    description:
      'Mehrere verlangte Anforderungen fehlen, oder es fehlt eine, ohne die sich die Stelle nicht ausfüllen lässt, etwa die verlangte Sprache oder ein großer Teil der verlangten Berufsjahre.',
  },
  {
    min: 0,
    max: 24,
    fit: 'Anderes Berufsfeld',
    description: 'Der Werdegang liegt in einem anderen Berufsfeld als die Stelle.',
  },
] as const
