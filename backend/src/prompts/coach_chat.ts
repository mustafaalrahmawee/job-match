import type {
  MessageCreateParamsNonStreaming,
  MessageParam,
  OutputConfig,
  ThinkingConfigParam,
} from '@anthropic-ai/sdk/resources/messages'
import type { CvAnalysis, CvRole } from './cv_analysis.js'

export const COACH_CHAT_MODEL = 'claude-sonnet-5-5'
export const COACH_CHAT_MAX_TOKENS = 8000

export const COACH_CHAT_THINKING = {
  normal: { type: 'between_tools' },
  extended: { type: 'adaptive' },
} as const satisfies Record<string, ThinkingConfigParam>

export const COACH_CHAT_EFFORTS = ['medium', 'high'] as const satisfies OutputConfig['effort'][]

export type Quality = keyof typeof COACH_CHAT_THINKING

export type Effort = (typeof COACH_CHAT_EFFORTS)[number]

export type ChatSettings = { quality: Quality; effort: Effort }

export type CoachCv = { role: CvRole | null; analysis: CvAnalysis; asOf: string }

export type Variant = { model?: string; effort?: OutputConfig['effort']; quality?: Quality }

export const COACH_CHAT_SYSTEM = ''

export const COACH_CHAT_NO_CV = ''

export const COACH_CHAT_CV_RULES = ''

export function cvAside({ role, analysis, asOf }: CoachCv): string {
  const sections: [string, string[]][] = [
    ['Zielrolle', [role ?? `${analysis.suggested_role} (vorgeschlagen, noch nicht bestätigt)`]],
    ['Stationen', analysis.positions.map((p) => `${p.title}, ${p.employer}, ${p.start ?? 'unbekannt'} bis ${p.end ?? 'heute'}`)],
    ['Kenntnisse', analysis.skills],
    ['Ausbildung', analysis.education.map((e) => [e.degree, e.institution, e.year].filter(Boolean).join(', '))],
    ['Höchster Abschluss', analysis.highest_degree ? [analysis.highest_degree] : []],
    ['Sprachen', analysis.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name))],
    ['Stärken', analysis.strengths],
    ['Schwächen', analysis.weaknesses],
    ['Tipps', analysis.tips],
  ]
  const body = sections
    .map(([title, items]) => `${title}:\n${items.map((item) => `- ${item}`).join('\n') || '- keine Angabe'}`)
    .join('\n\n')
  return `<lebenslauf quelle="Analyse der aktiven Lebenslauf-Version in job-match" stand="${asOf}">\n${body}\n</lebenslauf>`
}

export function coachChatRequest(
  messages: MessageParam[],
  { quality, effort }: ChatSettings,
  cv: CoachCv | null,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  return {
    model: variant.model ?? COACH_CHAT_MODEL,
    max_tokens: COACH_CHAT_MAX_TOKENS,
    thinking: COACH_CHAT_THINKING[variant.quality ?? quality],
    output_config: { effort: variant.effort ?? effort },
    system: [
      { type: 'text', text: COACH_CHAT_SYSTEM },
      { type: 'text', text: cv ? `${COACH_CHAT_CV_RULES}\n\n${cvAside(cv)}` : COACH_CHAT_NO_CV },
    ],
    messages,
  }
}
