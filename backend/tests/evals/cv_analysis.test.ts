import { expect, test } from 'vitest'
import { type Check, type CvAnalysisGold, cvAnalysisChecks, mentions, type RunRecord, tallyChecks } from '../../evals/checks.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis.js'

const GOLD: CvAnalysisGold = {
  is_cv: true,
  role: 'Frontend',
  accepted_roles: ['Frontend', 'Fullstack'],
  positions: [
    { employer: 'Nordlicht Software', title: 'Frontend-Entwicklerin', years: '2022–heute' },
    { employer: 'Stadtwerke Kiel', title: 'Werkstudentin IT', years: '2020–2022' },
  ],
  must_skills: [
    { name: 'Vue.js', synonyms: ['Vue', 'Vue 3'] },
    { name: 'TypeScript', synonyms: [] },
  ],
  absent_skills: ['Kubernetes', 'Java'],
  languages: ['Deutsch', 'Englisch'],
  highest_degree: 'B.Sc. Informatik',
  forbidden: ['Senior-Niveau'],
}

const ANALYSIS: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Frontend',
  positions: [
    { employer: 'Nordlicht Software GmbH', title: 'Frontend-Entwicklerin', start: '2022-03', end: null },
    { employer: 'Stadtwerke Kiel', title: 'Werkstudentin IT', start: '2020', end: '2022' },
  ],
  skills: ['Vue 3', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Docker'],
  education: [{ degree: 'B.Sc. Informatik', institution: 'Universität Kiel', year: '2022' }],
  highest_degree: 'B.Sc. Informatik',
  languages: [
    { name: 'Deutsch', level: 'Muttersprache' },
    { name: 'Englisch', level: 'C1' },
  ],
  strengths: ['Drei Jahre Vue-Erfahrung bei Nordlicht Software.'],
  weaknesses: ['Keine Testing-Werkzeuge genannt.'],
  tips: ['Projekte mit Nutzerzahlen beschreiben.'],
}

function answer(analysis: Partial<CvAnalysis> | string, stop_reason = 'end_turn'): RunRecord {
  const text = typeof analysis === 'string' ? analysis : JSON.stringify({ ...ANALYSIS, ...analysis })
  return { text, stop_reason, input_tokens: 0, output_tokens: 0, cost_usd: 0, error: null }
}

function failed(run: RunRecord, gold: Partial<CvAnalysisGold> = {}): string[] {
  return cvAnalysisChecks({ ...GOLD, ...gold }, run)
    .filter((result) => !result.ok)
    .map((result) => `${result.name}: ${result.detail}`)
}

function names(run: RunRecord, gold: Partial<CvAnalysisGold> = {}): string[] {
  return cvAnalysisChecks({ ...GOLD, ...gold }, run).map((result) => result.name)
}

test('mentions matches whole words only', () => {
  expect(mentions('Vue 3 / Nuxt', 'Vue')).toBe(true)
  expect(mentions('JavaScript', 'Java')).toBe(false)
  expect(mentions('C++ und C#', 'C#')).toBe(true)
  expect(mentions('Englisch (C1)', 'englisch')).toBe(true)
})

test('a right answer passes every check', () => {
  expect(failed(answer({}))).toEqual([])
})

test('end_turn and schema come first', () => {
  expect(failed(answer({}, 'max_tokens'))).toEqual(['end_turn: max_tokens'])
  expect(names(answer('not json'))).toEqual(['end_turn', 'schema'])
  expect(failed(answer('{"is_cv": true}'))[0]).toMatch(/^schema: /)
})

test('lists over their limits fail', () => {
  const skills = Array.from({ length: 31 }, (_, i) => `Skill ${i}`)
  expect(failed(answer({ skills: [...skills, 'Vue', 'TypeScript'] }))).toEqual(['limits: skills 33/30'])
})

test('a forbidden phrase fails wherever it appears', () => {
  expect(failed(answer({ tips: ['Die Person arbeitet auf Senior-Niveau.'] }))).toEqual(['forbidden: Senior-Niveau'])
})

test('a wrong is_cv short-circuits the case', () => {
  expect(names(answer({ is_cv: false }))).toEqual(['end_turn', 'schema', 'limits', 'forbidden', 'is_cv'])
  expect(failed(answer({ is_cv: false }))).toEqual(['is_cv: false, expected true'])
})

test('a non-CV with empty lists passes', () => {
  const empty: Partial<CvAnalysis> = {
    is_cv: false,
    suggested_role: 'Andere',
    positions: [],
    skills: [],
    education: [],
    highest_degree: null,
    languages: [],
    strengths: [],
    weaknesses: [],
    tips: [],
  }
  const gold: Partial<CvAnalysisGold> = {
    is_cv: false,
    role: 'Andere',
    accepted_roles: ['Andere'],
    positions: [],
    must_skills: [],
    absent_skills: [],
    languages: [],
    highest_degree: null,
  }
  expect(failed(answer(empty), gold)).toEqual([])
  expect(failed(answer({ ...empty, positions: ANALYSIS.positions }), gold)).toEqual(['positions: 2/0'])
})

test('the role must be one of the accepted roles', () => {
  expect(failed(answer({ suggested_role: 'Fullstack' }))).toEqual([])
  expect(failed(answer({ suggested_role: 'Backend' }))).toEqual(['role: Backend, expected Frontend or Fullstack'])
})

test('positions need the same count and every employer', () => {
  expect(failed(answer({ positions: [ANALYSIS.positions[0]] }))).toEqual(['positions: 1/2, missing Stadtwerke Kiel'])
  const renamed = [{ ...ANALYSIS.positions[0], employer: 'Nordlicht' }, ANALYSIS.positions[1]]
  expect(failed(answer({ positions: renamed }))).toEqual(['positions: 2/2, missing Nordlicht Software'])
})

test('must skills count with synonyms, absent skills as whole words', () => {
  expect(failed(answer({ skills: ['Vue.js', 'TypeScript'] }))).toEqual([])
  expect(failed(answer({ skills: ['React', 'TypeScript'] }))).toEqual(['must_skills: Vue.js'])
  expect(failed(answer({ skills: ['Vue', 'TypeScript', 'Kubernetes (Grundlagen)'] }))).toEqual([
    'absent_skills: Kubernetes in "Kubernetes (Grundlagen)"',
  ])
})

test('languages need the same count and names', () => {
  expect(failed(answer({ languages: [ANALYSIS.languages[0]] }))).toEqual(['languages: 1/2, missing Englisch'])
  const german = [ANALYSIS.languages[0], { name: 'German', level: 'C1' }]
  expect(failed(answer({ languages: german }))).toEqual(['languages: 2/2, missing Englisch'])
})

test('the highest degree must contain the gold wording', () => {
  expect(failed(answer({ highest_degree: 'M.Sc. Informatik' }))).toEqual([
    'highest_degree: M.Sc. Informatik, expected B.Sc. Informatik',
  ])
  expect(failed(answer({ highest_degree: null }))).toEqual(['highest_degree: null, expected B.Sc. Informatik'])
  expect(names(answer({ highest_degree: null }), { highest_degree: null })).not.toContain('highest_degree')
})

test('tallyChecks counts an item as right only when every run is right', () => {
  const ok = (name: string): Check => ({ name, ok: true, detail: '' })
  const bad = (name: string): Check => ({ name, ok: false, detail: '' })
  const runs = [
    [ok('is_cv'), ok('role'), ok('must_skills'), bad('must_skills')],
    [ok('is_cv'), bad('role'), ok('must_skills'), ok('must_skills')],
    [bad('is_cv')],
  ]
  const tallies = tallyChecks(runs, tallyChecks([[ok('is_cv'), ok('role')]]))
  expect(Object.fromEntries(tallies)).toEqual({
    is_cv: { ok: 1, total: 2 },
    role: { ok: 1, total: 2 },
    must_skills: { ok: 1, total: 2 },
  })
})
