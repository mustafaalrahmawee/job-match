import type { Message } from '@anthropic-ai/sdk/resources/messages'
import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches'
import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import { CV_ANALYSIS_EFFORT, CV_ANALYSIS_MODEL, type CvAnalysis } from '../../src/prompts/cv_analysis.js'
import { bearerFor, createAnna, useTestDatabase } from '../helpers.js'

const { app, auth, prisma, batches } = useTestDatabase()
let headers: { Authorization: string }

const PDF = Buffer.from('%PDF-1.7\nLebenslauf Anna Beispiel\n%%EOF')

const ANALYSIS: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Frontend',
  positions: [{ employer: 'Pixelwerk GmbH', title: 'Frontend-Entwicklerin', start: '2023-01', end: null }],
  skills: Array.from({ length: 40 }, (_, i) => `Skill ${i + 1}`),
  education: [{ degree: 'B.Sc. Informatik', institution: 'TU Berlin', year: '2022' }],
  highest_degree: 'B.Sc. Informatik',
  languages: [{ name: 'Deutsch', level: 'Muttersprache' }],
  strengths: Array.from({ length: 7 }, (_, i) => `Stärke ${i + 1}`),
  weaknesses: ['Keine Erfahrung mit Kubernetes'],
  tips: ['Ein Kubernetes-Projekt aufnehmen'],
}

beforeEach(async () => {
  headers = await bearerFor(auth, await createAnna(auth))
})

function succeeded(text: string, stopReason: Message['stop_reason'] = 'end_turn'): MessageBatchResult {
  return {
    type: 'succeeded',
    message: {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: CV_ANALYSIS_MODEL,
      content: [{ type: 'text', text, citations: null }],
      stop_reason: stopReason,
      stop_sequence: null,
      stop_details: null,
      usage: { input_tokens: 3000, output_tokens: 800, cache_read_input_tokens: 2100, cache_creation_input_tokens: 0 },
    } as unknown as Message,
  }
}

function upload(body: Buffer = PDF, type = 'application/pdf') {
  return request(app).post('/api/v1/cvs').set(headers).set('Content-Type', type).send(body)
}

function active() {
  return request(app).get('/api/v1/cvs/active').set(headers)
}

function finish(result: MessageBatchResult) {
  batches.results.set(batches.requests.at(-1)!.batchId, result)
}

async function uploadedId(): Promise<number> {
  return ((await upload()).body as { id: number }).id
}

test('an upload is stored as active version and sent as batch', async () => {
  const response = await upload()

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({ status: 'running', error: null, role: null, analysis: null })
  const id = (response.body as { id: number }).id
  const stored = await prisma.cvVersion.findUniqueOrThrow({ where: { id } })
  expect(Buffer.from(stored.pdf).equals(PDF)).toBe(true)
  expect(stored.isActive).toBe(true)
  expect(stored.effort).toBe(CV_ANALYSIS_EFFORT)
  expect(batches.requests).toHaveLength(1)
  const { customId, params } = batches.requests[0]
  expect(customId).toBe(`cv-${id}`)
  expect(params.model).toBe(CV_ANALYSIS_MODEL)
  expect(params.messages[0].content).toContainEqual({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: PDF.toString('base64') },
  })
})

test('a new upload archives the previous version', async () => {
  const first = await uploadedId()
  const second = await uploadedId()

  const versions = await prisma.cvVersion.findMany({ orderBy: { id: 'asc' } })
  expect(versions.map((v) => [v.id, v.isActive])).toEqual([
    [first, false],
    [second, true],
  ])
  expect(((await active()).body as { id: number }).id).toBe(second)
})

test('without a CV there is no active version', async () => {
  expect((await active()).status).toBe(404)
})

test('the version stays running while the batch is processing', async () => {
  await upload()

  const response = await active()

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ status: 'running', analysis: null })
})

test('a finished batch makes the version ready with trimmed lists, analysed once', async () => {
  await upload()
  finish(succeeded(JSON.stringify(ANALYSIS)))

  const response = await active()

  expect(response.status).toBe(200)
  const body = response.body as { status: string; analysis: CvAnalysis }
  expect(body.status).toBe('ready')
  expect(body.analysis.suggested_role).toBe('Frontend')
  expect(body.analysis.positions).toEqual(ANALYSIS.positions)
  expect(body.analysis.skills).toHaveLength(30)
  expect(body.analysis.strengths).toHaveLength(5)
  const stored = await prisma.cvVersion.findFirstOrThrow()
  expect(stored).toMatchObject({
    model: CV_ANALYSIS_MODEL,
    effort: CV_ANALYSIS_EFFORT,
    inputTokens: 3000,
    outputTokens: 800,
    cacheReadTokens: 2100,
    cacheWriteTokens: 0,
  })

  await active()
  expect(batches.lookups).toBe(1)
})

test.each([
  ['batch_failed', { type: 'errored', error: { type: 'error', error: { type: 'api_error', message: 'x' } } }],
  ['batch_failed', { type: 'expired' }],
  ['refused', succeeded('', 'refusal')],
  ['too_long', succeeded('{"is_cv": tr', 'max_tokens')],
  ['invalid_output', succeeded('Hier ist die Analyse: ...')],
  ['invalid_output', succeeded(JSON.stringify({ ...ANALYSIS, suggested_role: 'Astronaut' }))],
  ['not_cv', succeeded(JSON.stringify({ ...ANALYSIS, is_cv: false }))],
  ['language', succeeded(JSON.stringify({ ...ANALYSIS, language: 'fr' }))],
] as [string, MessageBatchResult][])('a failed analysis stores nothing and gives the reason %s', async (error, result) => {
  await upload()
  finish(result)

  const response = await active()

  expect(response.body).toMatchObject({ status: 'failed', error, analysis: null })
  expect((await prisma.cvVersion.findFirstOrThrow()).analysis).toBeNull()
})

test('a rejected file still records the token usage of the batch', async () => {
  await upload()
  finish(succeeded(JSON.stringify({ ...ANALYSIS, is_cv: false })))

  await active()

  const stored = await prisma.cvVersion.findFirstOrThrow()
  expect(stored).toMatchObject({ analysisStatus: 'failed', analysis: null, inputTokens: 3000, outputTokens: 800 })
})

test('a failed submit marks the version as failed', async () => {
  batches.failSubmit = true

  const response = await upload()

  expect(response.status).toBe(201)
  expect(response.body).toMatchObject({ status: 'failed', error: 'submit_failed' })
})

test('a failed analysis can be retried with a new batch', async () => {
  const id = await uploadedId()
  finish(succeeded(JSON.stringify({ ...ANALYSIS, is_cv: false })))
  await active()

  const retry = await request(app).post(`/api/v1/cvs/${id}/analysis`).set(headers)

  expect(retry.status).toBe(200)
  expect(retry.body).toMatchObject({ status: 'running', error: null })
  expect(batches.requests).toHaveLength(2)
  finish(succeeded(JSON.stringify(ANALYSIS)))
  expect((await active()).body).toMatchObject({ status: 'ready' })
})

test('a running or ready analysis cannot be retried', async () => {
  const id = await uploadedId()
  expect((await request(app).post(`/api/v1/cvs/${id}/analysis`).set(headers)).status).toBe(409)

  finish(succeeded(JSON.stringify(ANALYSIS)))
  await active()
  expect((await request(app).post(`/api/v1/cvs/${id}/analysis`).set(headers)).status).toBe(409)
  expect(batches.requests).toHaveLength(1)
})

test('the role is confirmed or changed once the analysis is ready', async () => {
  const id = await uploadedId()
  const confirm = (role: string) => request(app).patch(`/api/v1/cvs/${id}`).set(headers).send({ role })

  expect((await confirm('Frontend')).status).toBe(409)

  finish(succeeded(JSON.stringify(ANALYSIS)))
  await active()
  expect((await confirm('Astronaut')).status).toBe(422)
  const changed = await confirm('Fullstack')

  expect(changed.status).toBe(200)
  expect(changed.body).toMatchObject({ role: 'Fullstack', status: 'ready' })
  expect((await active()).body).toMatchObject({ role: 'Fullstack' })
})

test('the role of an archived version cannot be changed', async () => {
  const first = await uploadedId()
  finish(succeeded(JSON.stringify(ANALYSIS)))
  await active()
  await upload()

  const response = await request(app).patch(`/api/v1/cvs/${first}`).set(headers).send({ role: 'Data' })

  expect(response.status).toBe(409)
  expect((await prisma.cvVersion.findUniqueOrThrow({ where: { id: first } })).role).toBeNull()
})

test('only PDF files are accepted', async () => {
  expect((await upload(Buffer.from('Hallo'), 'application/pdf')).status).toBe(422)
  expect((await upload(PDF, 'text/plain')).status).toBe(422)
  expect((await request(app).post('/api/v1/cvs').set(headers).send({ pdf: 'x' })).status).toBe(422)
  expect(await prisma.cvVersion.count()).toBe(0)
})

test('a file over 5 MB is rejected', async () => {
  const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)])

  const response = await upload(big)

  expect(response.status).toBe(413)
  expect(await prisma.cvVersion.count()).toBe(0)
})

test('the CV routes need a token', async () => {
  const response = await request(app).get('/api/v1/cvs/active')

  expect(response.status).toBe(401)
  expect(response.get('WWW-Authenticate')).toBe('Bearer')
})

test('the CV of another account behaves as if it did not exist', async () => {
  const id = await uploadedId()
  finish(succeeded(JSON.stringify({ ...ANALYSIS, is_cv: false })))
  await active()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const benHeaders = await bearerFor(auth, ben)

  expect((await request(app).get('/api/v1/cvs/active').set(benHeaders)).status).toBe(404)
  expect((await request(app).post(`/api/v1/cvs/${id}/analysis`).set(benHeaders)).status).toBe(404)
  expect((await request(app).patch(`/api/v1/cvs/${id}`).set(benHeaders).send({ role: 'Data' })).status).toBe(404)
  expect(batches.requests).toHaveLength(1)
})
