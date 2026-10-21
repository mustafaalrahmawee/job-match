import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Job } from '../../src/generated/prisma/client.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis.js'
import {
  MATCH_ANALYSIS_EFFORT,
  MATCH_ANALYSIS_MODEL,
  MATCH_LIST_LIMITS,
  matchAnalysisRequest,
  type MatchAnalysis,
} from '../../src/prompts/match_analysis.js'
import { JOB_TEXT_MAX_CHARS } from '../../src/modules/jobs/jobs.schemas.js'
import { MATCH_RUNS_PER_DAY, MATCH_TIMEOUT_MS } from '../../src/modules/matches/matches.service.js'
import { bearerFor, createAnna, sentText, useTestDatabase } from '../helpers.js'

const { app, auth, prisma, messages } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number
let job: Job

const ANALYSIS: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Frontend',
  positions: [{ employer: 'Mediahaus GmbH', title: 'Frontend-Entwicklerin', start: '01/2023', end: null }],
  skills: ['Vue 3', 'TypeScript', 'Docker'],
  education: [],
  highest_degree: null,
  languages: [{ name: 'Englisch', level: 'C1' }],
  strengths: ['Architektur eines Redaktionssystems'],
  weaknesses: ['Keine Erfahrung mit Kubernetes'],
  tips: ['Ein Kubernetes-Projekt aufnehmen'],
}

const AD = 'Das bringst du mit: 3+ Jahre Vue oder React, TypeScript,\nContainer-Deployments (Docker, idealerweise Kubernetes).'

const MATCH: MatchAnalysis = {
  gaps: [
    {
      ad_quote: 'idealerweise Kubernetes',
      cv_quote: 'Docker',
      text: 'Kubernetes nennt der Lebenslauf nicht, die Anzeige wünscht es sich nur.',
    },
  ],
  strengths: [
    { ad_quote: '3+ Jahre Vue oder React', cv_quote: 'Vue 3', text: 'Vue 3 ist belegt.' },
    { ad_quote: null, cv_quote: 'Architektur eines Redaktionssystems', text: 'Architektur ist belegt.' },
  ],
  score: 82,
  tips: [{ ad_quote: 'idealerweise Kubernetes', cv_quote: null, text: 'Nenne Docker ausdrücklich.' }],
}

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
  job = await poolJob(AD)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function poolJob(description: string) {
  return prisma.job.create({
    data: {
      source: 'ba',
      externalId: `10000-${Math.random()}`,
      title: 'Senior Frontend Engineer (m/w/d)',
      company: 'Kreditwerk GmbH',
      city: 'Berlin',
      description,
      offerType: 'work',
      role: 'Frontend',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })
}

function readyCv(isActive = true) {
  return prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), isActive, analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
  })
}

function answers(...matches: (MatchAnalysis | string)[]) {
  let index = 0
  messages.answer(() => {
    const next = matches[Math.min(index++, matches.length - 1)]
    return sentText(typeof next === 'string' ? next : JSON.stringify(next))()
  })
}

function run(jobId = job.id, auth = headers) {
  return request(app).post('/api/v1/matches').set(auth).send({ job_id: jobId })
}

function overview(jobId = job.id) {
  return request(app).get(`/api/v1/matches/jobs/${jobId}`).set(headers)
}

test('a match analysis needs a login', async () => {
  const response = await request(app).post('/api/v1/matches').send({ job_id: job.id })

  expect(response.status).toBe(401)
  expect(response.headers['www-authenticate']).toBe('Bearer')
})

test('without a ready analysis of the active CV nothing is sent', async () => {
  await readyCv(false)
  await prisma.cvVersion.create({ data: { userId: annaId, pdf: new Uint8Array([2]), analysisStatus: 'running' } })

  const response = await run()

  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'no_cv' })
  expect(messages.requests).toHaveLength(0)
  expect(await prisma.matchRun.count()).toBe(0)
})

test('an own job of another user behaves as if it did not exist', async () => {
  await readyCv()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const own = await prisma.job.create({
    data: {
      source: 'own',
      userId: ben.id,
      externalId: 'ben-1',
      title: 'Frontend-Entwickler',
      city: 'Hamburg',
      description: AD,
      offerType: 'work',
      role: 'Andere',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })

  expect((await run(own.id)).status).toBe(404)
  expect((await overview(own.id)).status).toBe(404)
  expect((await run(999999)).status).toBe(404)
  expect(messages.requests).toHaveLength(0)
})

test('the request is the prompt unit with the active analysis, its role and the date of the run', async () => {
  await readyCv()
  answers(MATCH)

  await run()

  const asOf = new Date().toISOString().slice(0, 10)
  expect(messages.requests).toEqual([matchAnalysisRequest({ role: 'Frontend', analysis: ANALYSIS, asOf }, job)])
})

test('a valid answer is stored for the version and the job and comes back with its fit', async () => {
  const version = await readyCv()
  answers(MATCH)

  const response = await run()

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({
    job_id: job.id,
    score: 82,
    fit: 'Sehr gute Passung',
    strengths: MATCH.strengths,
    gaps: MATCH.gaps,
    tips: MATCH.tips,
    archived: false,
    cv_version: { id: version.id, role: 'Frontend' },
  })
  const stored = await prisma.matchResult.findMany()
  expect(stored).toHaveLength(1)
  expect(stored[0]).toMatchObject({ userId: annaId, cvVersionId: version.id, jobId: job.id, score: 82 })
  const runs = await prisma.matchRun.findMany()
  expect(runs).toEqual([
    expect.objectContaining({
      status: 'ready',
      model: MATCH_ANALYSIS_MODEL,
      effort: MATCH_ANALYSIS_EFFORT,
      inputTokens: 900,
      outputTokens: 300,
    }),
  ])
})

test('the lists are cut to their limits', async () => {
  await readyCv()
  const strength = MATCH.strengths[0]
  answers({ ...MATCH, strengths: Array.from({ length: MATCH_LIST_LIMITS.strengths + 2 }, () => strength) })

  const response = await run()

  expect((response.body as MatchAnalysis).strengths).toHaveLength(MATCH_LIST_LIMITS.strengths)
})

test('quotes are compared with collapsed whitespace', async () => {
  await readyCv()
  answers({ ...MATCH, tips: [{ ad_quote: 'TypeScript,   Container-Deployments', cv_quote: null, text: 'Tipp' }] })

  expect((await run()).status).toBe(201)
})

test('a missing quote sends the same request once more and logs the quote', async () => {
  await readyCv()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  answers({ ...MATCH, tips: [{ ad_quote: 'Kubernetes-Zertifikat', cv_quote: null, text: 'Tipp' }] }, MATCH)

  const response = await run()

  expect(response.status).toBe(201)
  expect(messages.requests).toHaveLength(2)
  expect(messages.requests[1]).toEqual(messages.requests[0])
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Kubernetes-Zertifikat" not in the ad'))
  expect(await prisma.matchRun.findFirst()).toMatchObject({ status: 'ready', inputTokens: 1800, outputTokens: 600 })
})

test.each([
  ['a list title', 'Kenntnisse'],
  ['an empty list', 'keine Angabe'],
  ['the tag line', 'Analyse der aktiven Lebenslauf-Version'],
  ['a weakness of the analysis', 'Keine Erfahrung mit Kubernetes'],
])('a CV quote from %s does not count, and after two attempts nothing is stored', async (_, cvQuote) => {
  await readyCv()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  answers({ ...MATCH, strengths: [{ ad_quote: null, cv_quote: cvQuote, text: 'Stärke' }] })

  const response = await run()

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'quotes_not_found' })
  expect(messages.requests).toHaveLength(2)
  expect(await prisma.matchResult.count()).toBe(0)
  expect(await prisma.matchRun.findFirst()).toMatchObject({ status: 'failed' })
})

test('a provider error is not retried by the service', async () => {
  await readyCv()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  messages.answer(() => Promise.reject(new Error('529 overloaded')))

  const response = await run()

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'unavailable' })
  expect(messages.requests).toHaveLength(1)
  expect(await prisma.matchRun.findFirst()).toMatchObject({ status: 'failed' })
})

test('a job deleted during the run keeps the provider error as answer', async () => {
  await readyCv()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  messages.answer(async () => {
    await prisma.job.delete({ where: { id: job.id } })
    throw new Error('529 overloaded')
  })

  const response = await run()

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail: 'unavailable' })
})

test('a run that takes longer than the timeout ends as timeout', async () => {
  await readyCv()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort())
  messages.answer(() => Promise.reject(new Error('Request was aborted.')))

  const response = await run()

  expect(timeout).toHaveBeenCalledWith(MATCH_TIMEOUT_MS)
  expect(response.status).toBe(504)
  expect(response.body).toEqual({ detail: 'timeout' })
})

test.each([
  ['refused', sentText('', 'refusal')],
  ['too_long', sentText('{"gaps": [', 'max_tokens')],
  ['invalid_output', sentText('kein JSON')],
  ['invalid_output', sentText(JSON.stringify({ ...MATCH, score: 82.5 }))],
  ['invalid_output', sentText(JSON.stringify({ ...MATCH, gaps: [{ ad_quote: ' ', cv_quote: null, text: 'Lücke' }] }))],
])('an unusable answer fails as %s without a second attempt', async (detail, reply) => {
  await readyCv()
  messages.answer(reply)

  const response = await run()

  expect(response.status).toBe(502)
  expect(response.body).toEqual({ detail })
  expect(messages.requests).toHaveLength(1)
  expect(await prisma.matchResult.count()).toBe(0)
})

test('at most five runs a day count, failed ones included', async () => {
  await readyCv()
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  await prisma.matchRun.create({ data: { userId: annaId, jobId: job.id, model: 'm', status: 'ready', createdAt: yesterday } })
  await prisma.matchRun.createMany({
    data: Array.from({ length: MATCH_RUNS_PER_DAY - 1 }, () => ({ userId: annaId, jobId: job.id, model: 'm', status: 'failed' as const })),
  })
  answers(MATCH)

  expect((await run()).status).toBe(201)
  const response = await run()

  expect(response.status).toBe(429)
  expect(response.body).toEqual({ detail: 'limit_reached' })
  expect(messages.requests).toHaveLength(1)
})

test('a second run for the same job is refused while one is running', async () => {
  await readyCv()
  await prisma.matchRun.create({ data: { userId: annaId, jobId: job.id, model: 'm' } })
  answers(MATCH)

  const response = await run()

  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'running' })
  const other = await poolJob(AD)
  expect((await run(other.id)).status).toBe(201)
})

test('a run left running past the timeout does not block the job', async () => {
  await readyCv()
  const stale = new Date(Date.now() - MATCH_TIMEOUT_MS - 1000)
  await prisma.matchRun.create({ data: { userId: annaId, jobId: job.id, model: 'm', createdAt: stale } })
  answers(MATCH)

  expect((await run()).status).toBe(201)
})

test('a new run replaces the result of the same version', async () => {
  await readyCv()
  answers(MATCH)
  await run()
  answers({ ...MATCH, score: 60 })

  await run()

  const stored = await prisma.matchResult.findMany()
  expect(stored.map((result) => result.score)).toEqual([60])
})

test('a failed run keeps the earlier result', async () => {
  await readyCv()
  answers(MATCH)
  await run()
  messages.answer(sentText('kein JSON'))

  await run()

  const body = (await overview()).body as { current: { score: number } }
  expect(body.current.score).toBe(82)
})

test('a result is archived when the active version changes and comes back with it', async () => {
  const first = await readyCv()
  answers(MATCH)
  await run()

  const second = await prisma.$transaction(async (tx) => {
    await tx.cvVersion.update({ where: { id: first.id }, data: { isActive: false } })
    return tx.cvVersion.create({
      data: { userId: annaId, pdf: new Uint8Array([2]), analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
    })
  })
  const archived = (await overview()).body as { current: null; archived: { archived: boolean; cv_version: { id: number } }[] }
  expect(archived.current).toBeNull()
  expect(archived.archived).toHaveLength(1)
  expect(archived.archived[0]).toMatchObject({ archived: true, cv_version: { id: first.id } })

  answers({ ...MATCH, score: 60 })
  await run()
  const both = (await overview()).body as { current: { score: number; cv_version: { id: number } }; archived: unknown[] }
  expect(both.current).toMatchObject({ score: 60, cv_version: { id: second.id } })
  expect(both.archived).toHaveLength(1)

  await request(app).post(`/api/v1/cvs/${first.id}/activation`).set(headers)
  expect(((await overview()).body as { current: { score: number } }).current.score).toBe(82)
})

test('deleting a version removes its match results', async () => {
  const first = await readyCv()
  answers(MATCH)
  await run()
  await prisma.cvVersion.update({ where: { id: first.id }, data: { isActive: false } })
  await readyCv()

  const response = await request(app).delete(`/api/v1/cvs/${first.id}`).set(headers)

  expect(response.status).toBe(204)
  expect(await prisma.matchResult.count()).toBe(0)
})

test('the result belongs to the version read at the start, even if another becomes active meanwhile', async () => {
  const first = await readyCv()
  messages.answer(async () => {
    await prisma.cvVersion.update({ where: { id: first.id }, data: { isActive: false } })
    await readyCv()
    return sentText(JSON.stringify(MATCH))()
  })

  const response = await run()

  expect(response.body).toMatchObject({ archived: true, cv_version: { id: first.id } })
})

test('a description cut in the prompt is logged with the job', async () => {
  await readyCv()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const long = await poolJob(`${AD}\n${'x'.repeat(JOB_TEXT_MAX_CHARS)}`)
  answers(MATCH)

  expect((await run(long.id)).status).toBe(201)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining(`job ${long.id}`))
})

test('the overview needs a valid job id and is empty before the first run', async () => {
  expect((await request(app).get('/api/v1/matches/jobs/abc').set(headers)).status).toBe(422)

  const response = await overview()

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ current: null, archived: [] })
})

test('the list shows the results of the active version with their job, the best fit first', async () => {
  const first = await readyCv()
  const weaker = await poolJob(AD)
  answers({ ...MATCH, score: 40 })
  await run(weaker.id)
  answers(MATCH)
  await run()
  await prisma.cvVersion.update({ where: { id: first.id }, data: { isActive: false } })
  const second = await readyCv()
  answers({ ...MATCH, score: 60 })
  await run()
  answers({ ...MATCH, score: 70 })
  await run(weaker.id)

  const response = await request(app).get('/api/v1/matches').set(headers)

  expect(response.status).toBe(200)
  const list = response.body as { score: number; archived: boolean; job: { id: number; title: string }; cv_version: { id: number } }[]
  expect(list.map((entry) => [entry.job.id, entry.score])).toEqual([
    [weaker.id, 70],
    [job.id, 60],
  ])
  expect(list[0]).toMatchObject({ archived: false, cv_version: { id: second.id }, job: { title: job.title } })
})

test('the list never shows results of another user', async () => {
  await readyCv()
  answers(MATCH)
  await run()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')

  const response = await request(app).get('/api/v1/matches').set(await bearerFor(auth, ben))

  expect(response.status).toBe(200)
  expect(response.body).toEqual([])
})
