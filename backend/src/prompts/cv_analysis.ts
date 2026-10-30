import type { MessageCreateParamsNonStreaming, OutputConfig } from '@anthropic-ai/sdk/resources/messages'
import { z } from 'zod'

export const CV_ANALYSIS_MODEL = 'claude-haiku-5-5'
export const CV_ANALYSIS_EFFORT: OutputConfig['effort'] = 'medium'
export const CV_ANALYSIS_MAX_TOKENS = 16000

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

export const CV_LIST_LIMITS = {
  positions: 15,
  skills: 30,
  education: 8,
  languages: 8,
  strengths: 5,
  weaknesses: 5,
  tips: 5,
} as const

export type Variant = { model?: string; effort?: OutputConfig['effort'] }

export type CvRole = (typeof CV_ROLES)[number]

export type CoachCv = { role: CvRole | null; analysis: CvAnalysis; asOf: string }

export const cvAnalysisSchema = z.object({
  is_cv: z.boolean(),
  language: z.string(),
  positions: z.array(
    z.object({
      employer: z.string(),
      title: z.string(),
      start: z.string().nullable(),
      end: z.string().nullable(),
    }),
  ),
  skills: z.array(z.string()),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      year: z.string().nullable(),
    }),
  ),
  highest_degree: z.string().nullable(),
  languages: z.array(z.object({ name: z.string(), level: z.string().nullable() })),
  suggested_role: z.enum(CV_ROLES),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  tips: z.array(z.string()),
})

export type CvAnalysis = z.infer<typeof cvAnalysisSchema>

export const CV_ANALYSIS_JSON_SCHEMA = z.toJSONSchema(cvAnalysisSchema)

export function cvAside({ role, analysis, asOf }: CoachCv, only?: readonly string[]): string {
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
    .filter(([title]) => !only || only.includes(title))
    .map(([title, items]) => `${title}:\n${items.map((item) => `- ${item}`).join('\n') || '- keine Angabe'}`)
    .join('\n\n')
  return `<lebenslauf quelle="Analyse der aktiven Lebenslauf-Version in job-match" stand="${asOf}">\n${body}\n</lebenslauf>`
}

export function cvAnalysisRequest(pdfBase64: string, variant: Variant = {}): MessageCreateParamsNonStreaming {
  return {
    model: variant.model ?? CV_ANALYSIS_MODEL,
    max_tokens: CV_ANALYSIS_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: variant.effort ?? CV_ANALYSIS_EFFORT,
      format: { type: 'json_schema', schema: CV_ANALYSIS_JSON_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } }],
      },
    ],
  }
}
