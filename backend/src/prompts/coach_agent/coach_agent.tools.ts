import type { MessageParam, ToolUnion } from '@anthropic-ai/sdk/resources/messages'
import { z } from 'zod'

export const APPLICATION_TOOL = 'get_application'

export const applicationInputSchema = z.object({
  application_id: z
    .number()
    .refine(Number.isInteger)
    .describe('die Nummer der Bewerbung aus dem Abschnitt <bewerbungen>'),
})

export const TOOLS: ToolUnion[] = [
  {
    name: APPLICATION_TOOL,
    description:
      'Liest die Anzeige einer Bewerbung der Person und, falls vorhanden, ihre Match-Analyse zur aktiven Lebenslauf-Version mit Score, Lücken und Stärken. Das Werkzeug liest nur und ändert nichts.',
    input_schema: { ...z.toJSONSchema(applicationInputSchema), type: 'object' },
    strict: true,
  },
]

export const FILE_TOOL = 'get_applicant_file'
export const FILE_CALL_ID = 'toolu_applicant_file'

export const FILE_CALL: MessageParam = {
  role: 'assistant',
  content: [{ type: 'tool_use', id: FILE_CALL_ID, name: FILE_TOOL, input: {} }],
}
