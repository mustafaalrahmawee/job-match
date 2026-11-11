import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Variant } from '../../llm/send.js'
import * as config from './job_extract.config.js'
import { markedText, materialBlock } from './job_extract.material.js'
import { JSON_SCHEMA, type JobExtractInput } from './job_extract.schemas.js'
import * as prompt from './job_extract.texts.js'

export function jobExtractRequest(input: JobExtractInput, variant: Variant = {}): MessageCreateParamsNonStreaming {
  const material = input.kind === 'text' ? markedText(input.text) : input.data
  return {
    model: variant.model ?? config.MODEL,
    max_tokens: config.MAX_TOKENS,
    thinking: config.THINKING,
    output_config: {
      effort: variant.effort ?? config.EFFORT,
      format: { type: 'json_schema', schema: JSON_SCHEMA },
    },
    system: [prompt.FRAME, prompt.RULES, prompt.CONTRACT, prompt.FOREIGN].join('\n\n'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt.GLUE[input.kind] },
          materialBlock(input, material),
          { type: 'text', text: prompt.REFOCUS },
        ],
      },
    ],
  }
}
