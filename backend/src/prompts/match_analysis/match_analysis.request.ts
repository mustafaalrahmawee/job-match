import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { assemble, joined, type PromptElement, type Variant } from '../../llm/assemble.js'
import { newMarkId } from '../../llm/untrusted.js'
import type { CoachCv } from '../cv_analysis/cv_analysis.schemas.js'
import * as config from './match_analysis.config.js'
import { adDocument, markedAd, markedCv } from './match_analysis.material.js'
import { JSON_SCHEMA, type MatchJob } from './match_analysis.schemas.js'
import * as prompt from './match_analysis.texts.js'

const SYSTEM_PARTS = ['frame', 'rules', 'contract', 'foreign']
const MATERIAL_PARTS = ['cvGlue', 'cv', 'cvNote', 'adGlue']

export function matchAnalysisRequest(
  cv: CoachCv,
  job: MatchJob,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const id = newMarkId()
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [prompt.FRAME] },
    { id: 'rules', position: 1, tier: 3, versions: [prompt.RULES], requires: ['frame', 'cv', 'ad'] },
    {
      id: 'contract',
      position: 2,
      tier: 3,
      versions: [prompt.CONTRACT],
      requires: ['frame', 'rules', 'cv', 'ad'],
    },
    {
      id: 'foreign',
      position: 3,
      tier: 3,
      versions: [prompt.FOREIGN],
      requires: ['frame', 'rules', 'contract', 'cv', 'ad'],
    },
    { id: 'cvGlue', position: 4, tier: 3, versions: [prompt.CV_GLUE], requires: ['frame', 'cv'] },
    { id: 'cv', position: 5, tier: 3, versions: [markedCv(cv, id)] },
    { id: 'cvNote', position: 6, tier: 2, versions: [prompt.CV_NOTE], requires: ['frame', 'cv'] },
    { id: 'adGlue', position: 7, tier: 3, versions: [prompt.AD_GLUE], requires: ['frame', 'ad'] },
    { id: 'adTitle', position: 8, tier: 3, versions: [prompt.AD_TITLES[job.source]], requires: ['ad'] },
    { id: 'ad', position: 9, tier: 3, versions: [markedAd(job, id)] },
    {
      id: 'refocus',
      position: 10,
      tier: 3,
      versions: [prompt.REFOCUS],
      requires: ['frame', 'rules', 'contract', 'foreign', 'cv', 'ad'],
    },
  ]
  const { texts } = assemble(elements, config.INPUT_BUDGET)
  const content: ContentBlockParam[] = [
    { type: 'text', text: joined(texts, MATERIAL_PARTS) },
    adDocument(job, texts.get('ad'), texts.get('adTitle')),
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
