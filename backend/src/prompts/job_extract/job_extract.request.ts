import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { assemble, estimateTokens, joined, type PromptElement, type Variant } from '../../llm/assemble.js'
import {
  JOB_EXTRACT_EFFORT,
  JOB_EXTRACT_IMAGE_TOKENS,
  JOB_EXTRACT_INPUT_BUDGET,
  JOB_EXTRACT_MAX_TOKENS,
  JOB_EXTRACT_MODEL,
  JOB_EXTRACT_THINKING,
} from './job_extract.config.js'
import { markedText, materialBlock } from './job_extract.material.js'
import { JOB_EXTRACT_JSON_SCHEMA, type JobExtractInput } from './job_extract.schemas.js'
import {
  JOB_EXTRACT_CONTRACT,
  JOB_EXTRACT_FOREIGN,
  JOB_EXTRACT_FRAME,
  JOB_EXTRACT_GLUE,
  JOB_EXTRACT_REFOCUS,
  JOB_EXTRACT_RULES,
} from './job_extract.texts.js'

const SYSTEM_PARTS = ['frame', 'rules', 'contract', 'foreign']

export function jobExtractRequest(input: JobExtractInput, variant: Variant = {}): MessageCreateParamsNonStreaming {
  const material = input.kind === 'text' ? markedText(input.text) : input.data
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [JOB_EXTRACT_FRAME] },
    { id: 'rules', position: 1, tier: 3, versions: [JOB_EXTRACT_RULES], requires: ['frame'] },
    {
      id: 'contract',
      position: 2,
      tier: 3,
      versions: [JOB_EXTRACT_CONTRACT],
      requires: ['frame', 'rules', 'material'],
    },
    {
      id: 'foreign',
      position: 3,
      tier: 3,
      versions: [JOB_EXTRACT_FOREIGN],
      requires: ['frame', 'rules', 'contract', 'material'],
    },
    { id: 'glue', position: 4, tier: 3, versions: [JOB_EXTRACT_GLUE[input.kind]], requires: ['material'] },
    { id: 'material', position: 5, tier: 3, versions: [material] },
    {
      id: 'refocus',
      position: 6,
      tier: 3,
      versions: [JOB_EXTRACT_REFOCUS],
      requires: ['frame', 'rules', 'contract', 'material'],
    },
  ]
  const { texts } = assemble(elements, JOB_EXTRACT_INPUT_BUDGET, (text) =>
    input.kind === 'image' && text === input.data ? JOB_EXTRACT_IMAGE_TOKENS : estimateTokens(text),
  )
  const content: ContentBlockParam[] = [
    { type: 'text', text: texts.get('glue')! },
    materialBlock(input, texts.get('material')!),
    { type: 'text', text: texts.get('refocus')! },
  ]
  return {
    model: variant.model ?? JOB_EXTRACT_MODEL,
    max_tokens: JOB_EXTRACT_MAX_TOKENS,
    thinking: JOB_EXTRACT_THINKING,
    output_config: {
      effort: variant.effort ?? JOB_EXTRACT_EFFORT,
      format: { type: 'json_schema', schema: JOB_EXTRACT_JSON_SCHEMA },
    },
    system: joined(texts, SYSTEM_PARTS),
    messages: [{ role: 'user', content }],
  }
}
