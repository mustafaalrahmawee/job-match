import { expect, test } from 'vitest'
import {
  COACH_CHAT_CV_RULES,
  COACH_CHAT_NO_CV,
  COACH_CHAT_SYSTEM,
  type CoachCv,
  coachChatRequest,
} from '../../src/prompts/coach_chat.js'

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

function cvBlock(cv: CoachCv | null): string {
  const [rules, context] = coachChatRequest(messages, settings, cv).system as { text: string }[]
  expect(rules.text).toBe(COACH_CHAT_SYSTEM)
  return context.text
}

test('without a ready CV the second block says the coach knows none', () => {
  expect(cvBlock(null)).toBe(COACH_CHAT_NO_CV)
})

test('with a ready CV the second block holds the rules and the analysis as a marked aside', () => {
  const block = cvBlock(cv)
  expect(block.startsWith(`${COACH_CHAT_CV_RULES}\n\n<lebenslauf quelle="`)).toBe(true)
  expect(block).toContain('stand="2026-10-16">\nZielrolle:\n- Frontend\n')
  expect(block).toContain('- Frontend-Entwicklerin, Pixelpfad Digital GmbH, 2023-03 bis heute')
  expect(block).toContain('Kenntnisse:\n- Vue 3\n- TypeScript')
  expect(block).toContain('Sprachen:\n- Englisch (C1)')
  expect(block).toContain('Schwächen:\n- keine Angabe')
  expect(block.endsWith('</lebenslauf>')).toBe(true)
})

test('an unconfirmed role is marked as suggested', () => {
  expect(cvBlock({ ...cv, role: null })).toContain('- Fullstack (vorgeschlagen, noch nicht bestätigt)')
})
