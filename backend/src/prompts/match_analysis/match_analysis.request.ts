import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Variant } from '../../llm/send.js'
import { newMarkId } from '../../llm/untrusted.js'
import type { CoachCv } from '../cv_analysis/cv_analysis.schemas.js'
import * as config from './match_analysis.config.js'
import { adDocument, markedAd, markedCv } from './match_analysis.material.js'
import { JSON_SCHEMA, type MatchJob } from './match_analysis.schemas.js'
import * as prompt from './match_analysis.texts.js'

export function matchAnalysisRequest(
  cv: CoachCv,
  job: MatchJob,
  variant: Variant = {},
): MessageCreateParamsNonStreaming {
  const id = newMarkId()
  const material = [prompt.CV_GLUE, markedCv(cv, id), prompt.CV_NOTE, prompt.AD_GLUE]
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
          { type: 'text', text: material.join('\n\n') },
          adDocument(job, markedAd(job, id)),
          { type: 'text', text: prompt.REFOCUS },
        ],
      },
    ],
  }
}
