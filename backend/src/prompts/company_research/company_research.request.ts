import type {
  ContentBlockParam,
  MessageCreateParamsNonStreaming,
  MessageParam,
} from '@anthropic-ai/sdk/resources/messages'
import { assemble, joined, type PromptElement, type Variant } from '../../llm/assemble.js'
import * as config from './company_research.config.js'
import { markedRequest } from './company_research.material.js'
import type { CompanyResearchInput } from './company_research.schemas.js'
import * as prompt from './company_research.texts.js'
import { TOOLS } from './company_research.tools.js'

const SYSTEM_PARTS = ['frame', 'rules', 'contract', 'foreign', 'examples', 'glue']

export function companyResearchRequest(
  input: CompanyResearchInput,
  asOf: string,
  markId: string,
  steps: MessageParam[] = [],
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [prompt.FRAME] },
    { id: 'rules', position: 1, tier: 3, versions: [prompt.RULES], requires: ['frame'] },
    {
      id: 'contract',
      position: 2,
      tier: 3,
      versions: [prompt.CONTRACT],
      requires: ['frame', 'rules', 'foreign'],
    },
    {
      id: 'foreign',
      position: 3,
      tier: 3,
      versions: [prompt.FOREIGN],
      requires: ['frame', 'rules', 'request'],
    },
    { id: 'examples', position: 4, tier: 3, versions: [prompt.EXAMPLES], requires: ['contract', 'foreign'] },
    { id: 'glue', position: 5, tier: 3, versions: [prompt.GLUE], requires: ['frame', 'request'] },
    { id: 'request', position: 6, tier: 3, versions: [markedRequest(input, asOf, markId)] },
    {
      id: 'refocus',
      position: 7,
      tier: 3,
      versions: [prompt.REFOCUS],
      requires: ['frame', 'rules', 'foreign', 'request'],
    },
    ...steps.map(
      (step, j): PromptElement => ({
        id: `step-${j}`,
        position: 8 + j,
        tier: 3,
        versions: [JSON.stringify(step)],
        requires: [j === 0 ? 'request' : `step-${j - 1}`],
      }),
    ),
  ]
  const { texts } = assemble(elements, config.INPUT_BUDGET)
  const content: ContentBlockParam[] = [
    { type: 'text', text: texts.get('request')! },
    { type: 'text', text: texts.get('refocus')! },
  ]
  const tail = steps.map((_, j): MessageParam => JSON.parse(texts.get(`step-${j}`)!) as MessageParam)
  return {
    model: variant.model ?? config.MODEL,
    max_tokens: config.MAX_TOKENS,
    thinking: config.THINKING,
    output_config: { effort: variant.effort ?? config.EFFORT },
    system: joined(texts, SYSTEM_PARTS),
    tools: TOOLS,
    messages: [{ role: 'user', content }, ...tail],
  }
}
