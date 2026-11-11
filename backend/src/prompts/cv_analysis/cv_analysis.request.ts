import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Variant } from '../../llm/send.js'
import * as config from './cv_analysis.config.js'
import { checkDate } from './cv_analysis.material.js'
import { JSON_SCHEMA } from './cv_analysis.schemas.js'
import * as prompt from './cv_analysis.texts.js'

export function cvAnalysisRequest(
  pdfBase64: string,
  analyzedAt: Date,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const system = [
    prompt.FRAME,
    prompt.ROLE_LIST,
    prompt.RULES,
    prompt.CONTRACT,
    prompt.FOREIGN,
    checkDate(analyzedAt),
  ]
  return {
    model: variant.model ?? config.MODEL,
    max_tokens: config.MAX_TOKENS,
    thinking: config.THINKING,
    output_config: {
      effort: variant.effort ?? config.EFFORT,
      format: { type: 'json_schema', schema: JSON_SCHEMA },
    },
    system: system.join('\n\n'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt.GLUE },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: prompt.REFOCUS },
        ],
      },
    ],
  }
}
