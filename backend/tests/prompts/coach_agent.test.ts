import type { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { expect, test } from 'vitest'
import * as coachConfig from '../../src/prompts/coach_agent/coach_agent.config.js'
import { coachAgentRequest } from '../../src/prompts/coach_agent/coach_agent.request.js'
import type { CoachAgentContext } from '../../src/prompts/coach_agent/coach_agent.schemas.js'
import * as coachPrompt from '../../src/prompts/coach_agent/coach_agent.texts.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis/cv_analysis.schemas.js'
import { requestText } from '../helpers.js'

const messages = [{ role: 'user' as const, content: 'Habe ich Kubernetes-Erfahrung?' }]
const settings = { quality: 'normal', effort: 'medium' } as const
const asOf = '2026-10-16'

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
  expect(text).toContain(coachPrompt.SYSTEM)
  expect(text).toContain(coachPrompt.NO_CV)
  expect(text).not.toContain(coachPrompt.CV_RULES)
})

test('with a ready CV the request holds the CV rules and every fact of the analysis', () => {
  const text = requestText(coachAgentRequest(messages, [], settings, withCv))
  expect(text).toContain(coachPrompt.CV_RULES)
  expect(text).not.toContain(coachPrompt.NO_CV)
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
  expect(request.messages[1]).toEqual({ role: 'user', content: coachPrompt.FILE_OPEN })
  expect(request.messages[4]).toEqual({ role: 'assistant', content: coachPrompt.FILE_CLOSE })
  expect(request.messages[5]).toEqual({
    role: 'user',
    content: [
      { type: 'text', text: 'Wie lang soll ein Anschreiben sein?' },
      { type: 'text', text: coachPrompt.REFOCUS },
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
        ? { ...step, content: [...step.content, { type: 'text', text: coachPrompt.NEXT_ROUND }] }
        : step,
    ),
  )

  const last = [...steps, ...round(coachConfig.TOOL_ROUNDS)]
  const final = coachAgentRequest(messages, last, settings, noCv)
  expect(final.tool_choice).toEqual({ type: 'none' })
  expect(final.messages.at(-1)!.content).toContainEqual({ type: 'text', text: coachPrompt.LAST_ROUND })
  expect(last.at(-1)!.content).not.toContainEqual({ type: 'text', text: coachPrompt.LAST_ROUND })
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
    .filter(({ text }) => text === coachPrompt.NEXT_ROUND || text === coachPrompt.LAST_ROUND)
    .map(({ text }) => text)
  expect(hints).toEqual([coachPrompt.NEXT_ROUND, coachPrompt.NEXT_ROUND, coachPrompt.NEXT_ROUND, coachPrompt.LAST_ROUND])
  expect(history).toEqual(messages)
  expect(context).toEqual(full)
})

test('a long history is cut at a user turn, the history note appears and the prefix holds', () => {
  const history = [...longHistory, { role: 'user' as const, content: 'Und jetzt?' }]

  const requests = roundsOf(history, { ...full, applications })

  expectOnePrefix(requests)
  const text = requestText(requests[0])
  expect(requests[0].system).toContainEqual({ type: 'text', text: coachPrompt.HISTORY_NOTE })
  expect(requests[0].messages[0]).toMatchObject({ role: 'user' })
  expect(text).toContain('Frage 5')
  expect(text).not.toContain('Frage 1')
  expect(text).toContain('Stelle 50,')
  expect(text).not.toContain('Stelle 51,')
  expect(text).toContain('Weitere Bewerbungen, die länger nicht geändert wurden und hier nicht stehen: 150')
})

test('a short history goes in whole and without the history note', () => {
  const request = coachAgentRequest(messages, [], settings, full)

  expect(request.system).toEqual([{ type: 'text', text: coachPrompt.SYSTEM }])
})
