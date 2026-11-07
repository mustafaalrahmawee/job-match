import type { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { assemble, joined, type PromptElement } from '../../llm/assemble.js'
import { marked } from '../../llm/untrusted.js'
import {
  COACH_AGENT_MAX_TOKENS,
  COACH_AGENT_MODEL,
  COACH_AGENT_RESEARCH_LIMIT,
  COACH_AGENT_STEPS_BUDGET,
  COACH_AGENT_THINKING,
  COACH_AGENT_TOOL_ROUNDS,
  COACH_AGENT_TURN_BUDGET,
} from './coach_agent.config.js'
import {
  applicationsVersions,
  cvVersions,
  messageText,
  recentHistory,
  researchAside,
} from './coach_agent.material.js'
import type { ChatSettings, CoachAgentContext, CoachVariant } from './coach_agent.schemas.js'
import {
  COACH_AGENT_APPLICATIONS_GLUE,
  COACH_AGENT_CONTRACT,
  COACH_AGENT_CV_NOTE,
  COACH_AGENT_CV_RULES,
  COACH_AGENT_FILE_CLOSE,
  COACH_AGENT_FILE_EMPTY,
  COACH_AGENT_FILE_OPEN,
  COACH_AGENT_FOREIGN,
  COACH_AGENT_FRAME,
  COACH_AGENT_HISTORY_NOTE,
  COACH_AGENT_LAST_ROUND,
  COACH_AGENT_NEXT_ROUND,
  COACH_AGENT_NO_CV,
  COACH_AGENT_REFOCUS,
  COACH_AGENT_RESEARCH_GLUE,
  COACH_AGENT_RULES,
} from './coach_agent.texts.js'
import { COACH_AGENT_FILE_CALL, COACH_AGENT_FILE_CALL_ID, COACH_AGENT_TOOLS } from './coach_agent.tools.js'

const SYSTEM_PARTS = ['frame', 'rules', 'contract', 'foreign']
const FILE_PARTS = ['cv', 'research-0', 'research-1', 'research-2', 'applications']
const GLUE_PARTS = ['cvGlue', 'noCv', 'cvNote', 'researchGlue', 'applicationsGlue']

export function coachAgentRequest(
  messages: MessageParam[],
  steps: MessageParam[],
  { quality, effort }: ChatSettings,
  { cv, applications, researches, asOf, markId }: CoachAgentContext,
  variant: CoachVariant = {},
): MessageCreateParamsNonStreaming {
  const { turns, cut } = recentHistory(messages.slice(0, -1))
  const base = 5 + turns.length
  const rounds = (end: number) => steps.slice(0, end).filter((step) => step.role === 'user').length
  const final = rounds(steps.length) >= COACH_AGENT_TOOL_ROUNDS
  const cvElements: PromptElement[] = cv
    ? [
        {
          id: 'cv',
          position: base + 2,
          tier: 1,
          score: 0.6,
          versions: cvVersions(cv, asOf, markId),
        },
        { id: 'cvGlue', position: base + 7, tier: 2, versions: [COACH_AGENT_CV_RULES], requires: ['frame', 'cv'] },
        { id: 'cvNote', position: base + 8, tier: 2, versions: [COACH_AGENT_CV_NOTE], requires: ['frame', 'cv'] },
      ]
    : [{ id: 'noCv', position: base + 7, tier: 2, versions: [COACH_AGENT_NO_CV], requires: ['frame'] }]
  const researchElements = researches.slice(0, COACH_AGENT_RESEARCH_LIMIT).map(
    (research, index): PromptElement => ({
      id: `research-${index}`,
      position: base + 3 + index,
      tier: 1,
      score: 0.74 - 0.02 * index,
      versions: [marked(researchAside(research), 'recherche', markId)],
    }),
  )
  const elements: PromptElement[] = [
    { id: 'frame', position: 0, tier: 3, versions: [COACH_AGENT_FRAME] },
    { id: 'rules', position: 1, tier: 3, versions: [COACH_AGENT_RULES], requires: ['frame'] },
    {
      id: 'contract',
      position: 2,
      tier: 3,
      versions: [COACH_AGENT_CONTRACT],
      requires: ['frame', 'rules', 'foreign'],
    },
    { id: 'foreign', position: 3, tier: 3, versions: [COACH_AGENT_FOREIGN], requires: ['frame', 'rules'] },
    { id: 'historyNote', position: 4, tier: 3, versions: [COACH_AGENT_HISTORY_NOTE], requires: ['frame'] },
    ...turns.map(
      ({ role, content }, index): PromptElement => ({
        id: `turn-${index}`,
        position: 5 + index,
        tier: 1,
        score: index >= turns.length - 2 ? 0.8 : (0.5 * index) / turns.length,
        versions: [content],
        ...(role === 'assistant' ? { requires: [`turn-${index - 1}`] } : {}),
      }),
    ),
    { id: 'fileOpen', position: base, tier: 3, versions: [COACH_AGENT_FILE_OPEN], requires: ['frame'] },
    {
      id: 'fileCall',
      position: base + 1,
      tier: 3,
      versions: [JSON.stringify(COACH_AGENT_FILE_CALL)],
      requires: ['fileOpen'],
    },
    ...cvElements,
    ...researchElements,
    {
      id: 'applications',
      position: base + 6,
      tier: 1,
      score: 0.9,
      versions: applicationsVersions(applications, asOf, markId),
    },
    { id: 'fileEmpty', position: base + 6.5, tier: 3, versions: [COACH_AGENT_FILE_EMPTY], requires: ['fileCall'] },
    { id: 'researchGlue', position: base + 9, tier: 2, versions: [COACH_AGENT_RESEARCH_GLUE], requires: ['frame'] },
    {
      id: 'applicationsGlue',
      position: base + 10,
      tier: 2,
      versions: [COACH_AGENT_APPLICATIONS_GLUE],
      requires: ['frame', 'applications'],
    },
    { id: 'fileClose', position: base + 11, tier: 3, versions: [COACH_AGENT_FILE_CLOSE], requires: ['fileCall'] },
    { id: 'live', position: base + 12, tier: 3, versions: [messageText(messages.at(-1)!)] },
    {
      id: 'refocus',
      position: base + 13,
      tier: 3,
      versions: [COACH_AGENT_REFOCUS],
      requires: ['frame', 'rules', 'foreign', 'live'],
    },
  ]
  const stepElements = steps.flatMap((step, index): PromptElement[] => {
    const message: PromptElement = {
      id: `step-${index}`,
      position: base + 14 + index,
      tier: 3,
      versions: [JSON.stringify(step)],
      ...(index ? { requires: [`step-${index - 1}`] } : {}),
    }
    if (step.role !== 'user') return [message]
    const last = rounds(index + 1) >= COACH_AGENT_TOOL_ROUNDS
    return [
      message,
      {
        id: `roundEnd-${index}`,
        position: base + 14.5 + index,
        tier: 3,
        versions: [last ? COACH_AGENT_LAST_ROUND : COACH_AGENT_NEXT_ROUND],
        requires: [`step-${index}`],
      },
    ]
  })
  const { texts, dropped } = assemble(elements, COACH_AGENT_TURN_BUDGET)
  const { texts: stepTexts } = assemble(stepElements, COACH_AGENT_STEPS_BUDGET)
  const gap = cut || dropped.some((key) => key.startsWith('turn-'))
  const file = [...texts]
    .filter(([key]) => FILE_PARTS.includes(key))
    .map(([, text]) => ({ type: 'text' as const, text }))
  const result = file.length ? file : [{ type: 'text' as const, text: texts.get('fileEmpty')! }]
  const glue = joined(texts, GLUE_PARTS)
  const history = turns.flatMap(({ role }, index): MessageParam[] => {
    const content = texts.get(`turn-${index}`)
    return content === undefined ? [] : [{ role, content }]
  })
  const tail = steps.map((_, index): MessageParam => {
    const step = JSON.parse(stepTexts.get(`step-${index}`)!) as MessageParam
    const hint = stepTexts.get(`roundEnd-${index}`)
    if (!hint || !Array.isArray(step.content)) return step
    return { ...step, content: [...step.content, { type: 'text', text: hint }] }
  })
  return {
    model: variant.model ?? COACH_AGENT_MODEL,
    max_tokens: COACH_AGENT_MAX_TOKENS,
    thinking: COACH_AGENT_THINKING[variant.quality ?? quality],
    output_config: { effort: variant.effort ?? effort },
    system: [
      { type: 'text', text: joined(texts, SYSTEM_PARTS) },
      ...(gap ? [{ type: 'text' as const, text: texts.get('historyNote')! }] : []),
    ],
    tools: COACH_AGENT_TOOLS,
    tool_choice: { type: final ? 'none' : 'auto' },
    messages: [
      ...history,
      { role: 'user', content: texts.get('fileOpen')! },
      JSON.parse(texts.get('fileCall')!) as MessageParam,
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: COACH_AGENT_FILE_CALL_ID, content: result },
          ...(glue ? [{ type: 'text' as const, text: glue }] : []),
        ],
      },
      { role: 'assistant', content: texts.get('fileClose')! },
      {
        role: 'user',
        content: [
          { type: 'text', text: texts.get('live')! },
          { type: 'text', text: texts.get('refocus')! },
        ],
      },
      ...tail,
    ],
  }
}
