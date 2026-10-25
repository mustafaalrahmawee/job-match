import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CvVersion, Job } from '../../src/generated/prisma/client.js'
import { INTERVIEW_LIMITS } from '../../src/modules/interviews/interviews.schemas.js'
import { INTERVIEW_SESSIONS_PER_DAY } from '../../src/modules/interviews/interviews.service.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis.js'
import { INTERVIEW_ANSWER_MAX_CHARS, INTERVIEW_GRADE_SYSTEM } from '../../src/prompts/interview_grade.js'
import { INTERVIEW_QUESTION_SYSTEM, interviewQuestionRequest } from '../../src/prompts/interview_question.js'
import { INTERVIEW_REPORT_RECOMMENDATIONS_MAX } from '../../src/prompts/interview_report.js'
import { bearerFor, createAnna, requestText, sentText, useTestDatabase } from '../helpers.js'

const { app, auth, prisma, messages } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number
let job: Job
let cv: CvVersion

const ANALYSIS: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Frontend',
  positions: [{ employer: 'Mediahaus GmbH', title: 'Frontend-Entwicklerin', start: '01/2023', end: null }],
  skills: ['Vue 3', 'TypeScript', 'Docker'],
  education: [],
  highest_degree: null,
  languages: [],
  strengths: [],
  weaknesses: [],
  tips: [],
}

const AD = 'Das bringst du mit: Vue 3, TypeScript,\nContainer-Deployments (Docker, idealerweise Kubernetes).'

const GAP = 'Kubernetes nennt der Lebenslauf nicht.'

type Kind = 'question' | 'grade' | 'report'
type Reply = object | string

const DEFAULTS: Record<Kind, (params: MessageCreateParamsNonStreaming) => Reply> = {
  question: () => {
    const number = messages.requests.filter((params) => params.system === INTERVIEW_QUESTION_SYSTEM).length
    return { gap: null, ad_quote: null, question: `Frage ${number}?`, title: `Thema ${number}` }
  },
  grade: () => ({ good: 'Konkretes Beispiel.', better: 'Nenne das Ergebnis.', score: 7 }),
  report: (params) => ({
    turns: graded(params).map((number) => ({ number, area: 'Projekterfahrung', line: `Zeile ${number}.` })),
    recommendations: ['Übe das Ergebnis.'],
  }),
}

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
  job = await prisma.job.create({
    data: {
      source: 'ba',
      externalId: `20000-${Math.random()}`,
      title: 'Frontend-Entwicklerin (m/w/d)',
      company: 'Mediahaus GmbH',
      city: 'Hamburg',
      description: AD,
      offerType: 'work',
      role: 'Frontend',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })
  cv = await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
  })
  await match(cv.id)
  script({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

function match(cvVersionId: number) {
  return prisma.matchResult.create({
    data: {
      userId: annaId,
      cvVersionId,
      jobId: job.id,
      score: 68,
      gaps: [{ ad_quote: 'idealerweise Kubernetes', cv_quote: 'Docker', text: GAP }],
      strengths: [{ ad_quote: 'Vue 3', cv_quote: 'Vue 3', text: 'Vue 3 ist belegt.' }],
      tips: [],
    },
  })
}

function graded(params: MessageCreateParamsNonStreaming): number[] {
  return requestText(params)
    .split('<runde nummer="')
    .slice(1)
    .filter((chunk) => chunk.split('</runde>')[0].includes('\nNote: '))
    .map((chunk) => Number(chunk.slice(0, chunk.indexOf('"'))))
}

function script(queues: Partial<Record<Kind, Reply[]>>) {
  const pending = { question: [...(queues.question ?? [])], grade: [...(queues.grade ?? [])], report: [...(queues.report ?? [])] }
  messages.answer(() => {
    const params = messages.requests.at(-1)!
    const kind: Kind =
      params.system === INTERVIEW_QUESTION_SYSTEM ? 'question' : params.system === INTERVIEW_GRADE_SYSTEM ? 'grade' : 'report'
    const next = pending[kind].length ? pending[kind].shift()! : DEFAULTS[kind](params)
    return sentText(typeof next === 'string' ? next : JSON.stringify(next))()
  })
}

function kinds(): Kind[] {
  return messages.requests.map((params) =>
    params.system === INTERVIEW_QUESTION_SYSTEM ? 'question' : params.system === INTERVIEW_GRADE_SYSTEM ? 'grade' : 'report',
  )
}

function start(difficulty = 'easy', jobId = job.id, auth = headers) {
  return request(app).post('/api/v1/interviews').set(auth).send({ job_id: jobId, difficulty })
}

function answer(id: number, text: string, auth = headers) {
  return request(app).post(`/api/v1/interviews/${id}/answer`).set(auth).send({ answer: text })
}

function skip(id: number) {
  return request(app).post(`/api/v1/interviews/${id}/skip`).set(headers)
}

function resume(id: number) {
  return request(app).post(`/api/v1/interviews/${id}/continue`).set(headers)
}

async function startedId(): Promise<number> {
  const response = await start()
  expect(response.status).toBe(201)
  return (response.body as { id: number }).id
}

test('start asks the first question from the ad, the current match and the difficulty', async () => {
  script({ question: [{ gap: `  ${GAP.replace(' ', '   ')} `, ad_quote: 'idealerweise  Kubernetes', question: 'Wie deployst du?', title: 'Deployment' }] })
  const response = await start()

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({
    job: { id: job.id, title: job.title, company: 'Mediahaus GmbH', city: 'Hamburg' },
    difficulty: 'easy',
    status: 'running',
    question_count: 6,
    pending: false,
    match_score: 68,
    report: null,
    turns: [
      {
        number: 1,
        title: 'Deployment',
        question: 'Wie deployst du?',
        gap: GAP,
        ad_quote: 'idealerweise  Kubernetes',
        answer: null,
        skipped: false,
        score: null,
      },
    ],
  })
  const current = await prisma.matchResult.findFirstOrThrow({ where: { jobId: job.id } })
  expect(messages.requests).toEqual([
    interviewQuestionRequest({
      job,
      match: { score: 68, gaps: current.gaps as never, strengths: current.strengths as never, createdAt: current.createdAt },
      difficulty: 'easy',
      earlier: [],
    }),
  ])
})

test('a gap or ad quote the model made up is stored as null and logged', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  script({ question: [{ gap: 'Erfundene Lücke', ad_quote: 'Rust', question: 'Frage?', title: 'Thema' }] })
  const response = await start()

  expect(response.body).toMatchObject({ turns: [{ gap: null, ad_quote: null }] })
  expect(warn).toHaveBeenCalledTimes(2)
})

test('without a current match there is no training and no model call', async () => {
  await prisma.matchResult.deleteMany()
  const response = await start()

  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'no_match' })
  expect(messages.requests).toHaveLength(0)
  expect(await prisma.interviewSession.count()).toBe(0)
})

test('a job the user cannot see behaves as missing and the input is validated', async () => {
  const other = await auth.createUser('ben@example.com', 'auch-geheim')
  const own = await prisma.job.create({
    data: { ...job, id: undefined, source: 'own', userId: other.id, externalId: 'own-ben', createdAt: undefined },
  })

  expect((await start('easy', own.id)).status).toBe(404)
  expect((await start('expert')).status).toBe(422)
  expect(messages.requests).toHaveLength(0)
})

test('a failed first question leaves no training behind', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  script({ question: ['kein JSON', 'kein JSON'] })
  const response = await start()

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'invalid_output' })
  expect(messages.requests).toHaveLength(2)
  expect(await prisma.interviewSession.count()).toBe(0)
})

test(`at most ${INTERVIEW_SESSIONS_PER_DAY} trainings start per day`, async () => {
  for (let index = 0; index < INTERVIEW_SESSIONS_PER_DAY; index++) expect((await start()).status).toBe(201)
  const response = await start()

  expect(response.status).toBe(429)
  expect(response.body).toEqual({ detail: 'limit_reached' })
})

test('an answer is stored, graded and followed by the next question', async () => {
  const id = await startedId()
  script({ grade: [{ good: 'x'.repeat(1500), better: 'Nenne die Zahl.', score: 8 }] })
  const response = await answer(id, 'Ich habe die Ladezeit halbiert.')

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    pending: false,
    turns: [
      { number: 1, answer: 'Ich habe die Ladezeit halbiert.', score: 8, better: 'Nenne die Zahl.' },
      { number: 2, title: 'Thema 2', answer: null, score: null },
    ],
  })
  const body = response.body as { turns: { good: string }[] }
  expect(body.turns[0].good).toHaveLength(INTERVIEW_LIMITS.good)
  expect(kinds()).toEqual(['question', 'grade', 'question'])
  expect(requestText(messages.requests[1])).toContain('Ich habe die Ladezeit halbiert.')
  expect(requestText(messages.requests[2])).toContain('Frage 1?')
})

test('an empty or too long answer is rejected and a question is answered only once', async () => {
  const id = await startedId()

  expect((await answer(id, '   ')).status).toBe(422)
  expect((await answer(id, 'x'.repeat(INTERVIEW_ANSWER_MAX_CHARS + 1))).status).toBe(422)
  expect((await answer(id, 'Antwort')).status).toBe(200)
  await prisma.interviewTurn.updateMany({ where: { number: 2 }, data: { answer: 'schon da', score: 5 } })
  const again = await answer(id, 'Noch einmal')

  expect(again.status).toBe(409)
  expect(again.body).toEqual({ detail: 'no_open_question' })
})

test('a skipped question is not graded and the training goes on', async () => {
  const id = await startedId()
  const response = await skip(id)

  expect(response.body).toMatchObject({ turns: [{ number: 1, skipped: true, score: null }, { number: 2 }] })
  expect(kinds()).toEqual(['question', 'question'])
})

test('after the last question the training is finished with a report', async () => {
  const id = await startedId()
  const scores = [8, 4, 6, 9, 7]
  const areas = { 1: 'Projekterfahrung', 3: 'Deployment', 4: ' Deployment ', 5: 'Projekterfahrung', 6: 'Motivation' }
  script({
    grade: scores.map((score) => ({ good: null, better: 'Kürzer.', score })),
    report: [
      {
        turns: Object.entries(areas).map(([number, area]) => ({ number: Number(number), area, line: `Zeile ${number}.` })),
        recommendations: ['Übe Deployment.', 'Schärfe die Motivation.', 'Belege das Ergebnis.', 'Vierte.'],
      },
    ],
  })
  await answer(id, 'Antwort 1')
  await skip(id)
  for (let number = 3; number <= 5; number++) await answer(id, `Antwort ${number}`)
  const response = await answer(id, 'Antwort 6')

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    status: 'finished',
    pending: false,
    report: {
      score: 7,
      strongest: { area: 'Projekterfahrung', average: 8.5 },
      weakest: { area: 'Deployment', average: 5 },
      recommendations: ['Übe Deployment.', 'Schärfe die Motivation.', 'Belege das Ergebnis.', 'Vierte.'].slice(
        0,
        INTERVIEW_REPORT_RECOMMENDATIONS_MAX,
      ),
    },
  })
  const body = response.body as { turns: { area: string | null; line: string | null; skipped: boolean }[]; finished_at: string }
  expect(body.turns.map((turn) => turn.line)).toEqual(['Zeile 1.', null, 'Zeile 3.', 'Zeile 4.', 'Zeile 5.', 'Zeile 6.'])
  expect(body.finished_at).not.toBeNull()
  expect(kinds().filter((kind) => kind === 'question')).toHaveLength(6)
  expect(kinds().filter((kind) => kind === 'grade')).toHaveLength(5)
  expect(kinds().filter((kind) => kind === 'report')).toHaveLength(1)
  expect(graded(messages.requests.at(-1)!)).toEqual([1, 3, 4, 5, 6])
})

test('a report without an entry for every graded question is retried and then fails', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const id = await startedId()
  const wrong = { turns: [{ number: 1, area: 'Motivation', line: 'Zeile.' }], recommendations: ['Übe.'] }
  script({ report: [wrong, wrong] })
  for (let number = 1; number <= 5; number++) await skip(id)
  const response = await answer(id, 'Antwort 6')

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'invalid_report' })
  const session = await request(app).get(`/api/v1/interviews/${id}`).set(headers)
  expect(session.body).toMatchObject({ status: 'finished', pending: true, report: null })

  const retried = await resume(id)
  expect(retried.body).toMatchObject({
    pending: false,
    report: { score: 7, strongest: { area: 'Projekterfahrung', average: 7 }, weakest: null },
  })
})

test('a failed grade keeps the answer and continue grades it later', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const id = await startedId()
  script({ grade: ['kaputt', 'kaputt'] })
  const failed = await answer(id, 'Meine Antwort')

  expect(failed.status).toBe(502)
  const paused = await request(app).get(`/api/v1/interviews/${id}`).set(headers)
  expect(paused.body).toMatchObject({ pending: true, turns: [{ answer: 'Meine Antwort', score: null }] })

  const resumed = await resume(id)
  expect(resumed.body).toMatchObject({ pending: false, turns: [{ score: 7 }, { number: 2 }] })
})

test('a training where every question was skipped ends without a report', async () => {
  const id = await startedId()
  for (let number = 1; number <= 6; number++) await skip(id)
  const session = await request(app).get(`/api/v1/interviews/${id}`).set(headers)

  expect(session.body).toMatchObject({ status: 'finished', pending: false, report: null })
  expect(kinds()).not.toContain('report')
})

test('a paused training resumes where it stopped and follows the current match', async () => {
  const id = await startedId()
  await prisma.cvVersion.update({ where: { id: cv.id }, data: { isActive: false } })
  const next = await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([2]), analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
  })
  const blocked = await answer(id, 'Antwort')

  expect(blocked.status).toBe(409)
  expect(blocked.body).toEqual({ detail: 'no_match' })
  await match(next.id)
  const resumed = await resume(id)
  expect(resumed.body).toMatchObject({ pending: false, turns: [{ score: 7 }, { number: 2, answer: null }] })

  const list = await request(app).get('/api/v1/interviews').set(headers)
  expect(list.body).toMatchObject([{ id, status: 'running', turns: [{ number: 1 }, { number: 2 }] }])
})

test('another user cannot see or continue a training', async () => {
  const id = await startedId()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const other = await bearerFor(auth, ben)

  expect((await request(app).get(`/api/v1/interviews/${id}`).set(other)).status).toBe(404)
  expect((await answer(id, 'Antwort', other)).status).toBe(404)
  expect((await request(app).post(`/api/v1/interviews/${id}/continue`).set(other)).status).toBe(404)
  expect((await request(app).get('/api/v1/interviews').set(other)).body).toEqual([])
  expect((await request(app).get('/api/v1/interviews')).status).toBe(401)
})
