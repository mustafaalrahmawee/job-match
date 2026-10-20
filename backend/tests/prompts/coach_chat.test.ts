import { expect, test } from 'vitest'
import {
  COACH_CHAT_CV_RULES,
  COACH_CHAT_NO_CV,
  COACH_CHAT_REFOCUS,
  COACH_CHAT_SYSTEM,
  type CoachCv,
  coachChatRequest,
} from '../../src/prompts/coach_chat.js'
import { requestText } from '../helpers.js'

const messages = [{ role: 'user' as const, content: 'Habe ich Kubernetes-Erfahrung?' }]
const settings = { quality: 'normal', effort: 'medium' } as const

const cv: CoachCv = {
  role: 'Frontend',
  asOf: '2026-10-16',
  analysis: {
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
  },
}

test('every prompt text of the coach is written', () => {
  expect(COACH_CHAT_SYSTEM.trim()).not.toBe('')
  expect(COACH_CHAT_NO_CV.trim()).not.toBe('')
  expect(COACH_CHAT_CV_RULES.trim()).not.toBe('')
})

test('without a ready CV the request holds the coach prompt and the no-CV text, but no CV rules', () => {
  const text = requestText(coachChatRequest(messages, settings, null))
  expect(text).toContain(COACH_CHAT_SYSTEM)
  expect(text).toContain(COACH_CHAT_NO_CV)
  expect(text).not.toContain(COACH_CHAT_CV_RULES)
})

test('with a ready CV the request holds the CV rules and every fact of the analysis', () => {
  const text = requestText(coachChatRequest(messages, settings, cv))
  expect(text).toContain(COACH_CHAT_SYSTEM)
  expect(text).toContain(COACH_CHAT_CV_RULES)
  expect(text).not.toContain(COACH_CHAT_NO_CV)
  for (const fact of [
    'Frontend',
    '2026-10-16',
    'Frontend-Entwicklerin',
    'Pixelpfad Digital GmbH',
    '2023-03',
    'Vue 3',
    'TypeScript',
    'B.Sc. Medieninformatik',
    'Hochschule Bonn-Rhein-Sieg',
    'Englisch',
    'C1',
    'Testet mit Vitest.',
    'Ergänze ein zweites Framework.',
  ]) {
    expect(text).toContain(fact)
  }
})

test('an unconfirmed role still reaches the request as the suggested one', () => {
  expect(requestText(coachChatRequest(messages, settings, { ...cv, role: null }))).toContain('Fullstack')
})

test('the refocus note follows only the last message, as its own block', () => {
  const history = [
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hallo' }] },
    { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'Hallo, ich bin dein Coach.' }] },
    { role: 'user' as const, content: 'Wie lang soll ein Anschreiben sein?' },
  ]
  const copy = structuredClone(history)

  const request = coachChatRequest(history, settings, null)

  expect(request.messages).toEqual([
    copy[0],
    copy[1],
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Wie lang soll ein Anschreiben sein?' },
        { type: 'text', text: COACH_CHAT_REFOCUS },
      ],
    },
  ])
  expect(history).toEqual(copy)
})

test('the date of the request is the stand of the CV aside', () => {
  expect(requestText(coachChatRequest(messages, settings, cv))).toContain('stand="2026-10-16"')
})
