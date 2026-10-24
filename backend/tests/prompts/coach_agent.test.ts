import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { expect, test } from 'vitest'
import {
  COACH_AGENT_CV_RULES,
  COACH_AGENT_LAST_ROUND,
  COACH_AGENT_NO_CV,
  COACH_AGENT_REFOCUS,
  COACH_AGENT_SYSTEM,
  COACH_AGENT_TOOL_ROUNDS,
  coachAgentRequest,
} from '../../src/prompts/coach_agent.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis.js'
import { requestText } from '../helpers.js'

const messages = [{ role: 'user' as const, content: 'Habe ich Kubernetes-Erfahrung?' }]
const settings = { quality: 'normal', effort: 'medium' } as const
const asOf = '2026-10-16'

const analysis: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Fullstack',
  positions: [{ employer: 'Pixelpfad Digital GmbH', title: 'Frontend-Entwicklerin', start: '2023-03', end: null }],
  skills: ['Vue 3', 'TypeScript'],
  education: [{ degree: 'B.Sc. Medieninformatik', institution: 'Hochschule Bonn-Rhein-Sieg', year: '2023' }],
  highest_degree: 'B.Sc. Medieninformatik',
  languages: [{ name: 'Englisch', level: 'C1' }],
  strengths: ['Testet mit Vitest.'],
  weaknesses: [],
  tips: ['Ergänze ein zweites Framework.'],
}

const noCv = { cv: null, applications: [], asOf }
const withCv = { cv: { role: 'Frontend' as const, analysis }, applications: [], asOf }

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

test('an unconfirmed role still reaches the request as the suggested one', () => {
  const cv = { role: null, analysis }
  expect(requestText(coachAgentRequest(messages, [], settings, { ...noCv, cv }))).toContain('Fullstack (vorgeschlagen')
})

test('earlier turns go as text only, empty ones are left out, and only the last message gets the refocus', () => {
  const history = [
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hallo' }] },
    { role: 'assistant' as const, content: [] },
    { role: 'user' as const, content: 'Wie lang soll ein Anschreiben sein?' },
  ]
  const copy = structuredClone(history)

  const request = coachAgentRequest(history, [], settings, noCv)

  expect(request.messages).toEqual([
    { role: 'user', content: 'Hallo' },
    {
      role: 'user',
      content: [
        { type: 'text', text: expect.stringContaining('- keine Bewerbungen') as unknown },
        { type: 'text', text: 'Wie lang soll ein Anschreiben sein?' },
        { type: 'text', text: COACH_AGENT_REFOCUS },
      ],
    },
  ])
  expect(history).toEqual(copy)
})

test('the steps of the turn follow unchanged, and the last round offers no tools', () => {
  const steps = [...round(1), ...round(2), ...round(3)]
  const open = coachAgentRequest(messages, steps, settings, noCv)
  expect(open.tool_choice).toEqual({ type: 'auto' })
  expect(open.messages.slice(-steps.length)).toEqual(steps)

  const last = [...steps, ...round(COACH_AGENT_TOOL_ROUNDS)]
  const final = coachAgentRequest(messages, last, settings, noCv)
  expect(final.tool_choice).toEqual({ type: 'none' })
  expect(final.messages.at(-1)!.content).toContainEqual({ type: 'text', text: COACH_AGENT_LAST_ROUND })
  expect(last.at(-1)!.content).not.toContainEqual({ type: 'text', text: COACH_AGENT_LAST_ROUND })
})
