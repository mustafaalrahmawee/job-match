import type { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { marked } from '../../llm/untrusted.js'
import { cvAside } from '../cv_analysis/cv_analysis.material.js'
import * as config from './coach_agent.config.js'
import { applicationsAside, messageText, recentHistory, researchAside } from './coach_agent.material.js'
import type { ChatSettings, CoachAgentContext, CoachVariant } from './coach_agent.schemas.js'
import * as prompt from './coach_agent.texts.js'
import { FILE_CALL, FILE_CALL_ID, TOOLS } from './coach_agent.tools.js'

export function coachAgentRequest(
  messages: MessageParam[],
  steps: MessageParam[],
  { quality, effort }: ChatSettings,
  { cv, applications, researches, asOf, markId }: CoachAgentContext,
  variant: CoachVariant = {},
): MessageCreateParamsNonStreaming {
  const { turns, cut } = recentHistory(messages.slice(0, -1))
  const file = [
    ...(cv ? [marked(cvAside({ ...cv, asOf }, config.CV_SECTIONS), 'lebenslauf', markId)] : []),
    ...researches
      .slice(0, config.RESEARCH_LIMIT)
      .map((research) => marked(researchAside(research), 'recherche', markId)),
    marked(applicationsAside(applications, asOf), 'bewerbungen', markId),
  ]
  const glue = [
    ...(cv ? [prompt.CV_RULES, prompt.CV_NOTE] : [prompt.NO_CV]),
    prompt.RESEARCH_GLUE,
    prompt.APPLICATIONS_GLUE,
  ]
  const rounds = (end: number) => steps.slice(0, end).filter((step) => step.role === 'user').length
  const tail = steps.map((step, index): MessageParam => {
    if (step.role !== 'user' || !Array.isArray(step.content)) return step
    const hint = rounds(index + 1) >= config.TOOL_ROUNDS ? prompt.LAST_ROUND : prompt.NEXT_ROUND
    return { ...step, content: [...step.content, { type: 'text', text: hint }] }
  })
  return {
    model: variant.model ?? config.MODEL,
    max_tokens: config.MAX_TOKENS,
    thinking: config.THINKING[variant.quality ?? quality],
    output_config: { effort: variant.effort ?? effort },
    system: [
      { type: 'text', text: prompt.SYSTEM },
      ...(cut ? [{ type: 'text' as const, text: prompt.HISTORY_NOTE }] : []),
    ],
    tools: TOOLS,
    tool_choice: { type: rounds(steps.length) >= config.TOOL_ROUNDS ? 'none' : 'auto' },
    messages: [
      ...turns,
      { role: 'user', content: prompt.FILE_OPEN },
      FILE_CALL,
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: FILE_CALL_ID,
            content: file.map((text) => ({ type: 'text' as const, text })),
          },
          { type: 'text', text: glue.join('\n\n') },
        ],
      },
      { role: 'assistant', content: prompt.FILE_CLOSE },
      {
        role: 'user',
        content: [
          { type: 'text', text: messageText(messages.at(-1)!) },
          { type: 'text', text: prompt.REFOCUS },
        ],
      },
      ...tail,
    ],
  }
}
