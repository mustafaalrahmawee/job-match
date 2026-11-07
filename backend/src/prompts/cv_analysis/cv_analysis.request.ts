import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { assemble, estimateTokens, joined, type PromptElement, type Variant } from '../../llm/assemble.js'
import * as config from './cv_analysis.config.js'
import { checkDate } from './cv_analysis.material.js'
import { JSON_SCHEMA } from './cv_analysis.schemas.js'
import * as prompt from './cv_analysis.texts.js'

const SYSTEM_PARTS = ['frame', 'roles', 'rules', 'contract', 'foreign', 'date']

export function cvAnalysisRequest(
  pdfBase64: string,
  analyzedAt: Date,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [prompt.FRAME] },
    { id: 'roles', position: 1, tier: 3, versions: [prompt.ROLE_LIST], requires: ['frame'] },
    { id: 'rules', position: 2, tier: 3, versions: [prompt.RULES], requires: ['frame', 'roles'] },
    {
      id: 'contract',
      position: 3,
      tier: 3,
      versions: [prompt.CONTRACT],
      requires: ['frame', 'roles', 'rules', 'pdf'],
    },
    {
      id: 'foreign',
      position: 4,
      tier: 3,
      versions: [prompt.FOREIGN],
      requires: ['frame', 'rules', 'contract', 'pdf'],
    },
    { id: 'date', position: 5, tier: 1, versions: [checkDate(analyzedAt)], requires: ['frame'] },
    { id: 'glue', position: 6, tier: 3, versions: [prompt.GLUE], requires: ['pdf'] },
    { id: 'pdf', position: 7, tier: 3, versions: [pdfBase64] },
    {
      id: 'refocus',
      position: 8,
      tier: 3,
      versions: [prompt.REFOCUS],
      requires: ['frame', 'roles', 'rules', 'contract', 'pdf'],
    },
  ]
  const { texts } = assemble(elements, config.INPUT_BUDGET, (text) =>
    text === pdfBase64 ? config.PDF_TOKENS : estimateTokens(text),
  )
  const content: ContentBlockParam[] = [
    { type: 'text', text: texts.get('glue')! },
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: texts.get('pdf')! } },
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
