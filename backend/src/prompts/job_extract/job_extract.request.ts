import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { assemble, estimateTokens, joined, type PromptElement, type Variant } from '../../llm/assemble.js'
import * as config from './job_extract.config.js'
import { markedText, materialBlock } from './job_extract.material.js'
import { JSON_SCHEMA, type JobExtractInput } from './job_extract.schemas.js'
import * as prompt from './job_extract.texts.js'

const SYSTEM_PARTS = ['frame', 'rules', 'contract', 'foreign']

export function jobExtractRequest(input: JobExtractInput, variant: Variant = {}): MessageCreateParamsNonStreaming {
  const material = input.kind === 'text' ? markedText(input.text) : input.data
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [prompt.FRAME] },
    { id: 'rules', position: 1, tier: 3, versions: [prompt.RULES], requires: ['frame'] },
    {
      id: 'contract',
      position: 2,
      tier: 3,
      versions: [prompt.CONTRACT],
      requires: ['frame', 'rules', 'material'],
    },
    {
      id: 'foreign',
      position: 3,
      tier: 3,
      versions: [prompt.FOREIGN],
      requires: ['frame', 'rules', 'contract', 'material'],
    },
    { id: 'glue', position: 4, tier: 3, versions: [prompt.GLUE[input.kind]], requires: ['material'] },
    { id: 'material', position: 5, tier: 3, versions: [material] },
    {
      id: 'refocus',
      position: 6,
      tier: 3,
      versions: [prompt.REFOCUS],
      requires: ['frame', 'rules', 'contract', 'material'],
    },
  ]
  const { texts } = assemble(elements, config.INPUT_BUDGET, (text) =>
    input.kind === 'image' && text === input.data ? config.IMAGE_TOKENS : estimateTokens(text),
  )
  const content: ContentBlockParam[] = [
    { type: 'text', text: texts.get('glue')! },
    materialBlock(input, texts.get('material')!),
    { type: 'text', text: texts.get('refocus')! },
  ]
  return {
    model: variant.model ?? config.MODEL,
    max_tokens: config.MAX_TOKENS,
    thinking: config.THINKING,
    output_config: {
      effort: variant.effort ?? config.EFFORT,
      format: { type: 'json_schema', schema: JSON_SCHEMA },
    },
    system: joined(texts, SYSTEM_PARTS),
    messages: [{ role: 'user', content }],
  }
}
