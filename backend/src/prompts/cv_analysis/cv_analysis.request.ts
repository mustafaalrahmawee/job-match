import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { assemble, estimateTokens, joined, type PromptElement, type Variant } from '../../llm/assemble.js'
import {
  CV_ANALYSIS_EFFORT,
  CV_ANALYSIS_INPUT_BUDGET,
  CV_ANALYSIS_MAX_TOKENS,
  CV_ANALYSIS_MODEL,
  CV_ANALYSIS_PDF_TOKENS,
  CV_ANALYSIS_THINKING,
} from './cv_analysis.config.js'
import { checkDate } from './cv_analysis.material.js'
import { CV_ANALYSIS_JSON_SCHEMA } from './cv_analysis.schemas.js'
import {
  CV_ANALYSIS_CONTRACT,
  CV_ANALYSIS_FOREIGN,
  CV_ANALYSIS_FRAME,
  CV_ANALYSIS_GLUE,
  CV_ANALYSIS_REFOCUS,
  CV_ANALYSIS_RULES,
  ROLE_LIST,
} from './cv_analysis.texts.js'

const SYSTEM_PARTS = ['frame', 'roles', 'rules', 'contract', 'foreign', 'date']

export function cvAnalysisRequest(
  pdfBase64: string,
  analyzedAt: Date,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [CV_ANALYSIS_FRAME] },
    { id: 'roles', position: 1, tier: 3, versions: [ROLE_LIST], requires: ['frame'] },
    { id: 'rules', position: 2, tier: 3, versions: [CV_ANALYSIS_RULES], requires: ['frame', 'roles'] },
    {
      id: 'contract',
      position: 3,
      tier: 3,
      versions: [CV_ANALYSIS_CONTRACT],
      requires: ['frame', 'roles', 'rules', 'pdf'],
    },
    {
      id: 'foreign',
      position: 4,
      tier: 3,
      versions: [CV_ANALYSIS_FOREIGN],
      requires: ['frame', 'rules', 'contract', 'pdf'],
    },
    { id: 'date', position: 5, tier: 1, versions: [checkDate(analyzedAt)], requires: ['frame'] },
    { id: 'glue', position: 6, tier: 3, versions: [CV_ANALYSIS_GLUE], requires: ['pdf'] },
    { id: 'pdf', position: 7, tier: 3, versions: [pdfBase64] },
    {
      id: 'refocus',
      position: 8,
      tier: 3,
      versions: [CV_ANALYSIS_REFOCUS],
      requires: ['frame', 'roles', 'rules', 'contract', 'pdf'],
    },
  ]
  const { texts } = assemble(elements, CV_ANALYSIS_INPUT_BUDGET, (text) =>
    text === pdfBase64 ? CV_ANALYSIS_PDF_TOKENS : estimateTokens(text),
  )
  const content: ContentBlockParam[] = [
    { type: 'text', text: texts.get('glue')! },
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: texts.get('pdf')! } },
    { type: 'text', text: texts.get('refocus')! },
  ]
  return {
    model: variant.model ?? CV_ANALYSIS_MODEL,
    max_tokens: CV_ANALYSIS_MAX_TOKENS,
    thinking: CV_ANALYSIS_THINKING,
    output_config: {
      effort: variant.effort ?? CV_ANALYSIS_EFFORT,
      format: { type: 'json_schema', schema: CV_ANALYSIS_JSON_SCHEMA },
    },
    system: joined(texts, SYSTEM_PARTS),
    messages: [{ role: 'user', content }],
  }
}
