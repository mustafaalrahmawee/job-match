import type { MessageParam, ToolUnion } from '@anthropic-ai/sdk/resources/messages'
import { z } from 'zod'

export const COACH_AGENT_APPLICATION_TOOL = 'get_application'

export const applicationInputSchema = z.object({
  application_id: z
    .number()
    .refine(Number.isInteger)
    .describe('die Nummer der Bewerbung aus dem Abschnitt <bewerbungen>'),
})

export const COACH_AGENT_TOOLS: ToolUnion[] = [
  {
    name: COACH_AGENT_APPLICATION_TOOL,
    description:
      'Liest die Anzeige einer Bewerbung der Person und, falls vorhanden, ihre Match-Analyse zur aktiven Lebenslauf-Version mit Score, Lücken und Stärken. Das Werkzeug liest nur und ändert nichts.',
    input_schema: { ...z.toJSONSchema(applicationInputSchema), type: 'object' },
    strict: true,
  },
]

export const COACH_AGENT_FILE_TOOL = 'get_applicant_file'
export const COACH_AGENT_FILE_CALL_ID = 'toolu_applicant_file'

export const COACH_AGENT_FILE_CALL: MessageParam = {
  role: 'assistant',
  content: [{ type: 'tool_use', id: COACH_AGENT_FILE_CALL_ID, name: COACH_AGENT_FILE_TOOL, input: {} }],
}
