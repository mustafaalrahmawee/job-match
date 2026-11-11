import type { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { Variant } from '../../llm/send.js'
import * as config from './company_research.config.js'
import { markedRequest } from './company_research.material.js'
import type { CompanyResearchInput } from './company_research.schemas.js'
import * as prompt from './company_research.texts.js'
import { TOOLS } from './company_research.tools.js'

export function companyResearchRequest(
  input: CompanyResearchInput,
  asOf: string,
  markId: string,
  steps: MessageParam[] = [],
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const system = [prompt.FRAME, prompt.RULES, prompt.CONTRACT, prompt.FOREIGN, prompt.EXAMPLES, prompt.GLUE]
  return {
    model: variant.model ?? config.MODEL,
    max_tokens: config.MAX_TOKENS,
    thinking: config.THINKING,
    output_config: { effort: variant.effort ?? config.EFFORT },
    system: system.join('\n\n'),
    tools: TOOLS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: markedRequest(input, asOf, markId) },
          { type: 'text', text: prompt.REFOCUS },
        ],
      },
      ...steps,
    ],
  }
}
