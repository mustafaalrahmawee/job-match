import type { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { expect, test } from 'vitest'
import { estimateTokens } from '../../src/llm/assemble.js'
import { COACH_AGENT_TOOL_ROUNDS } from '../../src/prompts/coach_agent/coach_agent.config.js'
import { coachAgentRequest } from '../../src/prompts/coach_agent/coach_agent.request.js'
import type { CoachAgentContext } from '../../src/prompts/coach_agent/coach_agent.schemas.js'
import {
  COACH_AGENT_CONTRACT,
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
  COACH_AGENT_RULES,
  COACH_AGENT_SYSTEM,
} from '../../src/prompts/coach_agent/coach_agent.texts.js'
import { COACH_AGENT_FILE_TOOL } from '../../src/prompts/coach_agent/coach_agent.tools.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis/cv_analysis.schemas.js'
import { requestText } from '../helpers.js'

const messages = [{ role: 'user' as const, content: 'Habe ich Kubernetes-Erfahrung?' }]
const settings = { quality: 'normal', effort: 'medium' } as const
const asOf = '2026-10-16'
const TURN_BUDGET = 100000

const analysis: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Fullstack',
  positions: [{ employer: 'Pixelpfad Digital GmbH', title: 'Frontend-Entwicklerin', start: '2023-03', ongoing: true, end: null }],
  skills: ['Vue 3', 'TypeScript'],
  education: [{ degree: 'B.Sc. Medieninformatik', institution: 'Hochschule Bonn-Rhein-Sieg', year: '2023' }],
  highest_degree: 'B.Sc. Medieninformatik',
  languages: [{ name: 'Englisch', level: 'C1' }],
  strengths: ['Testet mit Vitest.'],
  weaknesses: [],
  tips: ['Ergänze ein zweites Framework.'],
}

const markId = '9f2c41ab'
const noCv = { cv: null, applications: [], researches: [], asOf, markId }
const withCv = { cv: { role: 'Frontend' as const, analysis }, applications: [], researches: [], asOf, markId }

function round(n: number): MessageParam[] {
  return [
    { role: 'assistant', content: [{ type: 'tool_use', id: `toolu_${n}`, name: 'get_application', input: { application_id: 1 } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: `toolu_${n}`, content: 'Ergebnis' }] },
  ]
}

test('without a ready CV the request holds the coach prompt and the no-CV text, but no CV rules', () => {
  const text = requestText(coachAgentRequest(messages, [], settings, noCv))
  expect(text).toContain(COACH_AGENT_SYSTEM)
  expect(text).toContain(COACH_AGENT_NO_CV)
  expect(text).not.toContain(COACH_AGENT_CV_RULES)
})

test('with a ready CV the request holds the CV rules and every fact of the analysis', () => {
  const text = requestText(coachAgentRequest(messages, [], settings, withCv))
  expect(text).toContain(COACH_AGENT_CV_RULES)
  expect(text).not.toContain(COACH_AGENT_NO_CV)
  for (const fact of [
    'Frontend',
    'stand="2026-10-16"',
    'Frontend-Entwicklerin',
    'Pixelpfad Digital GmbH',
    '2023-03',
    'Vue 3',
    'B.Sc. Medieninformatik',
    'Hochschule Bonn-Rhein-Sieg',
    'Englisch (C1)',
    'Testet mit Vitest.',
    'Ergänze ein zweites Framework.',
  ]) {
    expect(text).toContain(fact)
  }
})

test('earlier turns go as text only, empty ones are left out, and only the last message gets the refocus', () => {
  const history = [
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hallo' }] },
    { role: 'assistant' as const, content: [] },
    { role: 'user' as const, content: 'Wie lang soll ein Anschreiben sein?' },
  ]
  const copy = structuredClone(history)

  const request = coachAgentRequest(history, [], settings, noCv)

  expect(request.messages.map((m) => m.role)).toEqual(['user', 'user', 'assistant', 'user', 'assistant', 'user'])
  expect(request.messages[0]).toEqual({ role: 'user', content: 'Hallo' })
  expect(request.messages[1]).toEqual({ role: 'user', content: COACH_AGENT_FILE_OPEN })
  expect(request.messages[4]).toEqual({ role: 'assistant', content: COACH_AGENT_FILE_CLOSE })
  expect(request.messages[5]).toEqual({
    role: 'user',
    content: [
      { type: 'text', text: 'Wie lang soll ein Anschreiben sein?' },
      { type: 'text', text: COACH_AGENT_REFOCUS },
    ],
  })
  expect(JSON.stringify(request.messages[3])).toContain('- keine Bewerbungen')
  expect(history).toEqual(copy)
})

test('the steps of the turn follow unchanged, and the last round offers no tools', () => {
  const steps = [...round(1), ...round(2), ...round(3)]
  const open = coachAgentRequest(messages, steps, settings, noCv)
  expect(open.tool_choice).toEqual({ type: 'auto' })
  expect(open.messages.slice(-steps.length)).toEqual(
    steps.map((step) =>
      step.role === 'user' && Array.isArray(step.content)
        ? { ...step, content: [...step.content, { type: 'text', text: COACH_AGENT_NEXT_ROUND }] }
        : step,
    ),
  )

  const last = [...steps, ...round(COACH_AGENT_TOOL_ROUNDS)]
  const final = coachAgentRequest(messages, last, settings, noCv)
  expect(final.tool_choice).toEqual({ type: 'none' })
  expect(final.messages.at(-1)!.content).toContainEqual({ type: 'text', text: COACH_AGENT_LAST_ROUND })
  expect(last.at(-1)!.content).not.toContainEqual({ type: 'text', text: COACH_AGENT_LAST_ROUND })
})

const research = { company: 'Kreditwerk', question: 'Wie groß?', content: 'Klein.', sources: [], createdAt: new Date('2026-10-15') }

const applications = Array.from({ length: 200 }, (_, index) => ({
  id: index + 1,
  status: 'saved' as const,
  changedAt: new Date('2026-10-15'),
  job: { title: `Stelle ${index + 1}`, company: 'Kreditwerk GmbH', city: 'Kiel' },
}))

const full = { ...withCv, applications: applications.slice(0, 3), researches: [research] }

const longHistory: MessageParam[] = [1, 2, 3, 4, 5].flatMap((n) => [
  { role: 'user', content: `Frage ${n} ${'x'.repeat(24000)}` },
  { role: 'assistant', content: `Antwort ${n}` },
])

function roundsOf(history: MessageParam[], context: CoachAgentContext) {
  return [0, 1, 2, 3, 4].map((n) =>
    coachAgentRequest(history, [1, 2, 3, 4].slice(0, n).flatMap(round), settings, context),
  )
}

function expectOnePrefix(requests: MessageCreateParamsNonStreaming[]) {
  requests.slice(1).forEach((request, index) => {
    const before = requests[index]
    expect(request.system).toEqual(before.system)
    expect(request.tools).toEqual(before.tools)
    expect(request.messages.slice(0, before.messages.length)).toEqual(before.messages)
    expect(request.messages).toHaveLength(before.messages.length + 2)
  })
}

test('every round of a turn keeps system, tools and all earlier messages of the round before', () => {
  const history = structuredClone(messages)
  const context = structuredClone(full)

  const requests = roundsOf(history, context)

  expectOnePrefix(requests)
  const last = requests[4].messages
  expect(JSON.stringify(last)).toContain(`<recherche-${markId} `)
  expect(JSON.stringify(last)).toContain(`<lebenslauf-${markId} `)
  expect(JSON.stringify(last)).toContain(`<bewerbungen-${markId} `)
  const hints = last
    .filter((message) => Array.isArray(message.content))
    .flatMap((message) => message.content as { type: string; text?: string }[])
    .filter(({ text }) => text === COACH_AGENT_NEXT_ROUND || text === COACH_AGENT_LAST_ROUND)
    .map(({ text }) => text)
  expect(hints).toEqual([COACH_AGENT_NEXT_ROUND, COACH_AGENT_NEXT_ROUND, COACH_AGENT_NEXT_ROUND, COACH_AGENT_LAST_ROUND])
  expect(history).toEqual(messages)
  expect(context).toEqual(full)
})

test('the prefix also holds when the budget cuts the file and the history note appears', () => {
  const history = [...longHistory, { role: 'user' as const, content: 'x'.repeat(283000) }]

  const requests = roundsOf(history, { ...full, applications })

  expectOnePrefix(requests)
  const text = requestText(requests[0])
  expect(requests[0].system).toContainEqual({ type: 'text', text: COACH_AGENT_HISTORY_NOTE })
  expect(text).toContain('Weitere Bewerbungen, die länger nicht geändert wurden')
  expect(text).not.toContain('Pixelpfad Digital GmbH')
  expect(text).not.toContain('Frage 1')
})

test('steps never shorten the fixed part and throw once they pass their own budget', () => {
  const step = (tokens: number): MessageParam[] => [
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_application', input: { application_id: 1 } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'x'.repeat(tokens * 3) }] },
  ]
  const open = coachAgentRequest(messages, [], settings, full)

  const large = coachAgentRequest(messages, step(870000), settings, full)

  expect(large.system).toEqual(open.system)
  expect(large.messages.slice(0, open.messages.length)).toEqual(open.messages)
  expect(large.messages.at(-1)!.content).toContainEqual(step(870000)[1].content[0])
  expect(() => coachAgentRequest(messages, step(890000), settings, full)).toThrow('Prompt over budget')
})

test('when the budget leaves no room for the file, the result says so and no note speaks about it', () => {
  const call = { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_applicant_file', name: COACH_AGENT_FILE_TOOL, input: {} }] }
  const fixed = [
    COACH_AGENT_FRAME,
    COACH_AGENT_RULES,
    COACH_AGENT_CONTRACT,
    COACH_AGENT_FOREIGN,
    COACH_AGENT_HISTORY_NOTE,
    COACH_AGENT_FILE_OPEN,
    JSON.stringify(call),
    COACH_AGENT_FILE_EMPTY,
    COACH_AGENT_FILE_CLOSE,
    COACH_AGENT_REFOCUS,
  ].reduce((sum, text) => sum + estimateTokens(text), 0)
  const live = 'x'.repeat((TURN_BUDGET - fixed) * 3)
  const context = { ...withCv, researches: [research] }

  const request = coachAgentRequest([{ role: 'user', content: live }], [], settings, context)

  expect(request.messages[2]).toEqual({
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_applicant_file',
        content: [{ type: 'text', text: COACH_AGENT_FILE_EMPTY }],
      },
    ],
  })
  expect(request.messages[1]).toEqual(call)
  expect(request.messages[3]).toEqual({ role: 'assistant', content: COACH_AGENT_FILE_CLOSE })
})
