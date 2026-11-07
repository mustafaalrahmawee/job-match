import { randomBytes } from 'node:crypto'
import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import { assemble, type PromptElement } from '../../llm/assemble.js'
import type { CoachCv } from '../cv_analysis/cv_analysis.schemas.js'
import {
  MATCH_ANALYSIS_EFFORT,
  MATCH_ANALYSIS_INPUT_BUDGET,
  MATCH_ANALYSIS_MAX_TOKENS,
  MATCH_ANALYSIS_MODEL,
  MATCH_ANALYSIS_THINKING,
} from './match_analysis.config.js'
import { adDocument, markedAd, markedCv } from './match_analysis.material.js'
import { MATCH_ANALYSIS_JSON_SCHEMA, type MatchJob, type Variant } from './match_analysis.schemas.js'
import {
  AD_TITLES,
  MATCH_ANALYSIS_AD_GLUE,
  MATCH_ANALYSIS_CONTRACT,
  MATCH_ANALYSIS_CV_GLUE,
  MATCH_ANALYSIS_CV_NOTE,
  MATCH_ANALYSIS_FOREIGN,
  MATCH_ANALYSIS_FRAME,
  MATCH_ANALYSIS_REFOCUS,
  MATCH_ANALYSIS_RULES,
} from './match_analysis.texts.js'

const SYSTEM_PARTS = ['frame', 'rules', 'contract', 'foreign']
const MATERIAL_PARTS = ['cvGlue', 'cv', 'cvNote', 'adGlue']

export function matchAnalysisRequest(
  cv: CoachCv,
  job: MatchJob,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const id = randomBytes(4).toString('hex')
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [MATCH_ANALYSIS_FRAME] },
    { id: 'rules', position: 1, tier: 3, versions: [MATCH_ANALYSIS_RULES], requires: ['frame', 'cv', 'ad'] },
    {
      id: 'contract',
      position: 2,
      tier: 3,
      versions: [MATCH_ANALYSIS_CONTRACT],
      requires: ['frame', 'rules', 'cv', 'ad'],
    },
    {
      id: 'foreign',
      position: 3,
      tier: 3,
      versions: [MATCH_ANALYSIS_FOREIGN],
      requires: ['frame', 'rules', 'contract', 'cv', 'ad'],
    },
    { id: 'cvGlue', position: 4, tier: 3, versions: [MATCH_ANALYSIS_CV_GLUE], requires: ['frame', 'cv'] },
    { id: 'cv', position: 5, tier: 3, versions: [markedCv(cv, id)] },
    { id: 'cvNote', position: 6, tier: 2, versions: [MATCH_ANALYSIS_CV_NOTE], requires: ['frame', 'cv'] },
    { id: 'adGlue', position: 7, tier: 3, versions: [MATCH_ANALYSIS_AD_GLUE], requires: ['frame', 'ad'] },
    { id: 'adTitle', position: 8, tier: 3, versions: [AD_TITLES[job.source]], requires: ['ad'] },
    { id: 'ad', position: 9, tier: 3, versions: [markedAd(job, id)] },
    {
      id: 'refocus',
      position: 10,
      tier: 3,
      versions: [MATCH_ANALYSIS_REFOCUS],
      requires: ['frame', 'rules', 'contract', 'foreign', 'cv', 'ad'],
    },
  ]
  const { texts } = assemble(elements, MATCH_ANALYSIS_INPUT_BUDGET)
  const joined = (parts: string[]) =>
    [...texts]
      .filter(([key]) => parts.includes(key))
      .map(([, text]) => text)
      .join('\n\n')
  const content: ContentBlockParam[] = [
    { type: 'text', text: joined(MATERIAL_PARTS) },
    adDocument(job, texts.get('ad'), texts.get('adTitle')),
    { type: 'text', text: texts.get('refocus')! },
  ]
  return {
    model: variant.model ?? MATCH_ANALYSIS_MODEL,
    max_tokens: MATCH_ANALYSIS_MAX_TOKENS,
    thinking: MATCH_ANALYSIS_THINKING,
    output_config: {
      effort: variant.effort ?? MATCH_ANALYSIS_EFFORT,
      format: { type: 'json_schema', schema: MATCH_ANALYSIS_JSON_SCHEMA },
    },
    system: joined(SYSTEM_PARTS),
    messages: [{ role: 'user', content }],
  }
}
