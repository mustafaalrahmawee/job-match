import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ContentBlock, MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import * as coachConfig from '../../src/prompts/coach_agent/coach_agent.config.js'
import * as coachPrompt from '../../src/prompts/coach_agent/coach_agent.texts.js'
import { TOOLS } from '../../src/prompts/coach_agent/coach_agent.tools.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis/cv_analysis.schemas.js'
import { RUNS_PER_DAY } from '../../src/shared/runs.js'
import { bearerFor, createAnna, requestText, streamed, streamedText, useTestDatabase } from '../helpers.js'

const { app, auth, prisma, model } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number

type SseEvent = { event: string; data: Record<string, unknown> }

const SETTINGS = { quality: 'normal', effort: 'medium' }

const ANALYSIS: CvAnalysis = {
  is_cv: true,
  language: 'de',
  suggested_role: 'Frontend',
  positions: [{ employer: 'Pixelwerk GmbH', title: 'Frontend-Entwicklerin', start: '2023-01', ongoing: true, end: null }],
  skills: ['Vue', 'TypeScript'],
  education: [],
  highest_degree: null,
  languages: [{ name: 'Deutsch', level: 'Muttersprache' }],
  strengths: [],
  weaknesses: ['Keine Erfahrung mit Kubernetes'],
  tips: [],
}

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function events(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const [eventLine, dataLine] = chunk.split('\n')
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')) as Record<string, unknown>,
      }
    })
}

function create(body: object = { title: 'Anschreiben' }) {
  return request(app).post('/api/v1/coach/conversations').set(headers).send(body)
}

async function newConversation(): Promise<number> {
  const response = await create()
  return (response.body as { id: number }).id
}

function send(id: number, content: string, settings: object = SETTINGS) {
  return request(app)
    .post(`/api/v1/coach/conversations/${id}/messages`)
    .set(headers)
    .send({ content, ...settings })
}

function retry(id: number, settings: object = SETTINGS) {
  return request(app).post(`/api/v1/coach/conversations/${id}/retry`).set(headers).send(settings)
}

test('a new conversation has its title and no messages', async () => {
  const created = await create({ title: '  Gehalt verhandeln ' })
  expect(created.status).toBe(201)
  const id = (created.body as { id: number }).id

  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)
  expect(show.status).toBe(200)
  expect(show.body).toEqual({ id, title: 'Gehalt verhandeln', messages: [] })
})

test('a conversation needs a title', async () => {
  for (const body of [{}, { title: '   ' }, { title: 'x'.repeat(201) }]) {
    expect((await create(body)).status).toBe(422)
  }
  expect(await prisma.conversation.count()).toBe(0)
})

test('a message streams the answer and saves both turns', async () => {
  const id = await newConversation()

  const response = await send(id, 'Was kannst du?')

  expect(response.status).toBe(200)
  expect(response.get('Content-Type')).toContain('text/event-stream')
  const stream = events(response.text)
  const deltas = stream.filter((e) => e.event === 'delta').map((e) => e.data.text as string)
  expect(deltas.join('')).toBe('Hallo, ich bin dein Coach.')
  expect(deltas.length).toBeGreaterThan(1)
  const done = stream.at(-1)!
  expect(done.event).toBe('done')
  expect(done.data).toMatchObject({
    stop_reason: 'end_turn',
    message: { role: 'assistant', text: 'Hallo, ich bin dein Coach.', stop_reason: 'end_turn' },
  })

  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)
  expect(show.body).toMatchObject({
    title: 'Anschreiben',
    messages: [
      { role: 'user', text: 'Was kannst du?', stop_reason: null },
      { role: 'assistant', text: 'Hallo, ich bin dein Coach.', stop_reason: 'end_turn' },
    ],
  })
  const stored = await prisma.message.findFirstOrThrow({ where: { role: 'assistant' } })
  expect(stored).toMatchObject({
    model: coachConfig.MODEL,
    effort: 'medium',
    quality: 'normal',
    inputTokens: 120,
    outputTokens: 30,
  })
})

test('the request carries the coach prompt and the whole history', async () => {
  const id = await newConversation()
  await send(id, 'Hallo')
  await send(id, 'Und wie lang soll ein Anschreiben sein?')

  const last = model.requests.at(-1)!
  expect(last.model).toBe(coachConfig.MODEL)
  expect(requestText(last)).toContain(coachPrompt.SYSTEM)
  expect(requestText(last)).toContain(coachPrompt.NO_CV)
  expect(last.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user'])
  expect(last.messages[0].content).toBe('Hallo')
  expect(applicantFile(last)).toContain('- keine Bewerbungen')
  expect(last.messages.at(-1)!.content).toEqual([
    { type: 'text', text: 'Und wie lang soll ein Anschreiben sein?' },
    { type: 'text', text: coachPrompt.REFOCUS },
  ])
})

test('the refocus note is neither stored nor shown', async () => {
  const id = await newConversation()
  await send(id, 'Hallo')
  await send(id, 'Und wie lang soll ein Anschreiben sein?')

  const stored = await prisma.message.findMany({ where: { role: 'user' }, orderBy: { id: 'asc' } })
  expect(stored.map((m) => m.content)).toEqual([
    [{ type: 'text', text: 'Hallo' }],
    [{ type: 'text', text: 'Und wie lang soll ein Anschreiben sein?' }],
  ])
  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)
  expect((show.body as { messages: { text: string }[] }).messages.map((m) => m.text)).toEqual([
    'Hallo',
    'Hallo, ich bin dein Coach.',
    'Und wie lang soll ein Anschreiben sein?',
    'Hallo, ich bin dein Coach.',
  ])
})

test('the coach gets the ready analysis of the active CV, its role and the date of the request', async () => {
  await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analyzedAt: new Date(), analysisStatus: 'ready', role: 'Backend', analysis: ANALYSIS },
  })
  const id = await newConversation()
  await send(id, 'Habe ich Kubernetes-Erfahrung?')

  const text = requestText(model.requests.at(-1)!)
  expect(text).toContain(coachPrompt.CV_RULES)
  for (const fact of [new Date().toISOString().slice(0, 10), 'Backend', 'Pixelwerk GmbH', 'Vue', 'TypeScript']) {
    expect(text).toContain(fact)
  }
})

test('a CV without a finished analysis, or an inactive one, leaves the coach without a CV', async () => {
  await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analyzedAt: new Date(), isActive: false, analysisStatus: 'ready', analysis: ANALYSIS },
  })
  await prisma.cvVersion.create({ data: { userId: annaId, pdf: new Uint8Array([2]), analyzedAt: new Date(), analysisStatus: 'running' } })
  const id = await newConversation()
  await send(id, 'Kennst du meinen Lebenslauf?')

  const text = requestText(model.requests.at(-1)!)
  expect(text).toContain(coachPrompt.NO_CV)
  expect(text).not.toContain('Pixelwerk GmbH')
})

test('a ready analysis without a confirmed role leaves the coach without a CV', async () => {
  await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analyzedAt: new Date(), analysisStatus: 'ready', analysis: ANALYSIS },
  })
  const id = await newConversation()
  await send(id, 'Kennst du meinen Lebenslauf?')

  const text = requestText(model.requests.at(-1)!)
  expect(text).toContain(coachPrompt.NO_CV)
  expect(text).not.toContain('Pixelwerk GmbH')
})

test('quality and effort reach the request and are stored with the answer', async () => {
  const id = await newConversation()
  const cases = [
    [{ quality: 'normal', effort: 'medium' }, { type: 'between_tools' }, 'medium'],
    [{ quality: 'normal', effort: 'high' }, { type: 'between_tools' }, 'high'],
    [{ quality: 'extended', effort: 'medium' }, { type: 'adaptive' }, 'medium'],
    [{ quality: 'extended', effort: 'high' }, { type: 'adaptive' }, 'high'],
  ] as const

  for (const [settings, thinking, effort] of cases) {
    await send(id, 'Wie lang soll ein Anschreiben sein?', settings)
    expect(model.requests.at(-1)).toMatchObject({ thinking, output_config: { effort } })
    const stored = await prisma.message.findFirstOrThrow({ where: { role: 'assistant' }, orderBy: { id: 'desc' } })
    expect(stored).toMatchObject({ quality: settings.quality, effort })
  }
})

test('quality and effort must be sent explicitly', async () => {
  const id = await newConversation()
  for (const settings of [
    {},
    { quality: 'normal' },
    { effort: 'high' },
    { quality: 'max', effort: 'medium' },
    { quality: 'normal', effort: 'low' },
  ]) {
    expect((await send(id, 'Hallo', settings)).status).toBe(422)
  }
  expect((await retry(id, {})).status).toBe(422)
  expect(model.requests).toHaveLength(0)
})

test('the list shows only own conversations, last used first', async () => {
  const first = await newConversation()
  const second = ((await create({ title: 'Gehalt' })).body as { id: number }).id
  await send(first, 'Hallo')
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  await request(app).post('/api/v1/coach/conversations').set(await bearerFor(auth, ben)).send({ title: 'Bens Gespräch' })

  const response = await request(app).get('/api/v1/coach/conversations').set(headers)

  const list = response.body as { id: number }[]
  expect(response.status).toBe(200)
  expect(list.map((c) => c.id)).toEqual([first, second])
  expect(list[0]).toEqual({ id: first, title: 'Anschreiben', updated_at: expect.any(String) as unknown })
})

test('a conversation can be renamed', async () => {
  const id = await newConversation()
  const rename = (title: string) =>
    request(app).patch(`/api/v1/coach/conversations/${id}`).set(headers).send({ title })

  const renamed = await rename('  Anschreiben für Acme ')
  expect(renamed.status).toBe(200)
  expect(renamed.body).toMatchObject({ id, title: 'Anschreiben für Acme' })
  expect((await rename('   ')).status).toBe(422)
  expect((await prisma.conversation.findUniqueOrThrow({ where: { id } })).title).toBe('Anschreiben für Acme')
})

test('a deleted conversation is gone with its messages', async () => {
  const id = await newConversation()
  await send(id, 'Hallo')

  const deleted = await request(app).delete(`/api/v1/coach/conversations/${id}`).set(headers)

  expect(deleted.status).toBe(204)
  expect(await prisma.message.count()).toBe(0)
  expect((await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)).status).toBe(404)
  expect((await request(app).delete(`/api/v1/coach/conversations/${id}`).set(headers)).status).toBe(404)
})

test('a failed answer keeps the question and can be retried', async () => {
  const id = await newConversation()
  model.answer(() => Promise.reject(new Error('overloaded')))

  const failed = await send(id, 'Wie verhandle ich mein Gehalt?')
  expect(events(failed.text).at(-1)).toEqual({
    event: 'error',
    data: { detail: 'The coach could not answer' },
  })
  expect(await prisma.message.count({ where: { role: 'assistant' } })).toBe(0)

  model.answer(streamedText('Nenne eine Spanne.'))
  const retried = await retry(id, { quality: 'extended', effort: 'high' })
  expect(events(retried.text).at(-1)!.data).toMatchObject({ message: { text: 'Nenne eine Spanne.' } })
  expect(model.requests.at(-1)).toMatchObject({ thinking: { type: 'adaptive' }, output_config: { effort: 'high' } })
  expect(model.requests.at(-1)!.messages).toHaveLength(5)
  expect(applicantFile(model.requests.at(-1)!)).toContain('<bewerbungen')
  expect(model.requests.at(-1)!.messages.at(-1)).toEqual({
    role: 'user',
    content: [
      { type: 'text', text: 'Wie verhandle ich mein Gehalt?' },
      { type: 'text', text: coachPrompt.REFOCUS },
    ],
  })

  expect((await retry(id)).status).toBe(409)
})

test('a stopped answer is saved as far as it got', async () => {
  const id = await newConversation()
  model.answer(streamedText('Ein Anschreiben', 'stopped'))

  const response = await send(id, 'Schreib mir ein Anschreiben')

  expect(events(response.text).at(-1)!.data).toMatchObject({
    stop_reason: 'stopped',
    message: { text: 'Ein Anschreiben', stop_reason: 'stopped' },
  })
})

test('a cut-off answer is saved with its stop reason', async () => {
  const id = await newConversation()
  for (const stopReason of ['max_tokens', 'model_context_window_exceeded'] as const) {
    model.answer(streamedText('Ein langes Anschreiben', stopReason))
    const response = await send(id, 'Schreib mir ein Anschreiben')
    expect(events(response.text).at(-1)!.data).toMatchObject({
      stop_reason: stopReason,
      message: { text: 'Ein langes Anschreiben', stop_reason: stopReason },
    })
  }
})

test('an unexpected stop reason is an error and saves no answer', async () => {
  const id = await newConversation()
  for (const stopReason of ['stop_sequence', 'pause_turn'] as const) {
    model.answer(streamedText('Ich suche kurz', stopReason))
    const response = await send(id, 'Was macht Acme?')
    expect(events(response.text).at(-1)).toEqual({ event: 'error', data: { detail: 'The coach could not answer' } })
  }
  expect(await prisma.message.count({ where: { role: 'assistant' } })).toBe(0)
})

test('an empty or refused answer is not saved', async () => {
  const id = await newConversation()
  for (const [text, stopReason] of [
    ['', 'stopped'],
    ['Dazu kann ich', 'refusal'],
  ] as const) {
    model.answer(streamedText(text, stopReason))
    const response = await send(id, 'Hallo')
    expect(events(response.text).at(-1)!.data).toEqual({ message: null, stop_reason: stopReason })
  }
  expect(await prisma.message.count({ where: { role: 'assistant' } })).toBe(0)
})

test('an empty message is rejected with 422', async () => {
  const id = await newConversation()
  const response = await send(id, '   ')
  expect(response.status).toBe(422)
  expect(model.requests).toHaveLength(0)
})

test("another user's conversation behaves as if it did not exist", async () => {
  const id = await newConversation()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const benHeaders = await bearerFor(auth, ben)

  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(benHeaders)
  const write = await request(app)
    .post(`/api/v1/coach/conversations/${id}/messages`)
    .set(benHeaders)
    .send({ content: 'Hallo', ...SETTINGS })
  const retried = await request(app).post(`/api/v1/coach/conversations/${id}/retry`).set(benHeaders).send(SETTINGS)
  const rename = await request(app).patch(`/api/v1/coach/conversations/${id}`).set(benHeaders).send({ title: 'Meins' })
  const remove = await request(app).delete(`/api/v1/coach/conversations/${id}`).set(benHeaders)
  const missing = await request(app).get('/api/v1/coach/conversations/999999').set(headers)

  expect([show.status, write.status, retried.status, rename.status, remove.status, missing.status]).toEqual([
    404, 404, 404, 404, 404, 404,
  ])
  expect(model.requests).toHaveLength(0)
  expect(await prisma.conversation.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: 'Anschreiben' })
})

test('the coach needs a login', async () => {
  const response = await request(app).post('/api/v1/coach/conversations').send({ title: 'Hallo' })
  expect(response.status).toBe(401)
})

function toolUse(id: string, input: unknown, name = 'get_application'): ContentBlock {
  return { type: 'tool_use', id, name, input, caller: { type: 'direct' } }
}

function text(value: string): ContentBlock {
  return { type: 'text', text: value, citations: null }
}

async function application(userId = annaId, title = 'Senior Frontend Engineer') {
  const job = await prisma.job.create({
    data: {
      source: 'ba',
      externalId: `10000-${Math.random()}`,
      title,
      company: 'Kreditwerk GmbH',
      city: 'Berlin',
      description: 'Wir suchen Vue 3, TypeScript und Erfahrung mit Kubernetes.',
      offerType: 'work',
      role: 'Frontend',
      fullTime: true,
      partTime: false,
      publishedAt: new Date(),
    },
  })
  return prisma.application.create({
    data: { userId, jobId: job.id, statusChanges: { create: { status: 'saved' } } },
  })
}

function toolResults(message: MessageParam) {
  const blocks = message.content as { type: string; tool_use_id: string; content: unknown; is_error?: boolean }[]
  return blocks.filter((block) => block.type === 'tool_result')
}

function applicantFile({ messages }: MessageCreateParamsNonStreaming): string {
  const [result] = messages.flatMap((message) => (Array.isArray(message.content) ? toolResults(message) : []))
  return (result.content as { text: string }[]).map(({ text: part }) => part).join('\n')
}

test('the coach gets the list of own applications with number, status and date', async () => {
  const own = await application()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  await application(ben.id, 'Bens Stelle')
  const id = await newConversation()

  await send(id, 'Welche Bewerbungen habe ich?')

  const list = applicantFile(model.requests[0])
  expect(list).toContain(`Bewerbung ${own.id}: Senior Frontend Engineer, Kreditwerk GmbH, Berlin; Status Gespeichert seit`)
  expect(list).not.toContain('Bens Stelle')
})

test('the coach reads an own application with ad and match and shows the step', async () => {
  const own = await application()
  const cv = await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analyzedAt: new Date(), analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
  })
  await prisma.matchResult.create({
    data: {
      userId: annaId,
      cvVersionId: cv.id,
      jobId: own.jobId,
      score: 68,
      gaps: [{ ad_quote: 'Kubernetes', cv_quote: null, text: 'Kubernetes fehlt' }],
      strengths: [{ ad_quote: 'Vue 3', cv_quote: 'Vue', text: 'Vue passt' }],
      tips: [],
      confirmedAt: new Date(),
    },
  })
  const id = await newConversation()
  model.answer(
    streamed({ content: [toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Für Senior Frontend Engineer bei Kreditwerk GmbH: 1. Wie deployst du?'),
  )

  const response = await send(id, 'Fünf Interviewfragen für Kreditwerk')

  const stream = events(response.text)
  const step = { kind: 'application', application_id: own.id, title: 'Senior Frontend Engineer', company: 'Kreditwerk GmbH' }
  expect(stream.filter((e) => e.event === 'step').map((e) => e.data)).toEqual([step])
  expect(model.requests).toHaveLength(2)
  const [assistant, results] = model.requests[1].messages.slice(-2)
  expect(assistant).toEqual({ role: 'assistant', content: [toolUse('toolu_1', { application_id: own.id })] })
  const [result] = toolResults(results)
  expect(result).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' })
  expect(result.is_error).toBeUndefined()
  const resultText = JSON.stringify(result.content)
  for (const fact of ['Wir suchen Vue 3', 'Score: 68 von 100', 'Kubernetes fehlt', 'Vue passt']) {
    expect(resultText).toContain(fact)
  }
  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)
  expect((show.body as { messages: unknown[] }).messages[1]).toMatchObject({ steps: [step] })
})

test('a match that is not confirmed does not reach the coach', async () => {
  const own = await application()
  const cv = await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analyzedAt: new Date(), analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
  })
  await prisma.matchResult.create({
    data: {
      userId: annaId,
      cvVersionId: cv.id,
      jobId: own.jobId,
      score: 68,
      gaps: [{ ad_quote: 'Kubernetes', cv_quote: null, text: 'Kubernetes fehlt' }],
      strengths: [],
      tips: [],
    },
  })
  const id = await newConversation()
  model.answer(
    streamed({ content: [toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Fragen aus der Anzeige.'),
  )

  await send(id, 'Interviewfragen bitte')

  const [result] = toolResults(model.requests[1].messages.at(-1)!)
  expect(JSON.stringify(result.content)).not.toContain('Kubernetes fehlt')
})

test('an application without a match says so in the result', async () => {
  const own = await application()
  const id = await newConversation()
  model.answer(
    streamed({ content: [toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Fragen aus der Anzeige.'),
  )

  await send(id, 'Interviewfragen bitte')

  expect(JSON.stringify(toolResults(model.requests[1].messages.at(-1)!)[0].content)).toContain(coachPrompt.NO_MATCH)
})

test('a foreign, unknown or invalid application and an unknown tool come back as errors', async () => {
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const foreign = await application(ben.id)
  const id = await newConversation()
  model.answer(
    streamed({
      content: [
        toolUse('toolu_1', { application_id: foreign.id }),
        toolUse('toolu_2', { application_id: 999999 }),
        toolUse('toolu_3', { application_id: 'eins' }),
        toolUse('toolu_4', { application_id: 1 }, 'set_status'),
      ],
      stopReason: 'tool_use',
    }),
    streamedText('Welche Bewerbung meinst du?'),
  )

  const response = await send(id, 'Lies meine Bewerbung')

  const results = toolResults(model.requests[1].messages.at(-1)!)
  expect(results.map((r) => [r.tool_use_id, r.content, r.is_error])).toEqual([
    ['toolu_1', coachPrompt.ERRORS.not_found, true],
    ['toolu_2', coachPrompt.ERRORS.not_found, true],
    ['toolu_3', coachPrompt.ERRORS.invalid_input, true],
    ['toolu_4', coachPrompt.ERRORS.unknown_tool, true],
  ])
  expect(events(response.text).filter((e) => e.event === 'step')).toHaveLength(4)
  expect(JSON.stringify(model.requests)).not.toContain('Wir suchen Vue 3')
})

test('after four rounds with tools the last round offers none', async () => {
  const id = await newConversation()
  model.answer(
    ...[1, 2, 3, 4].map((n) =>
      streamed({ content: [toolUse(`toolu_${n}`, { application_id: 999999 })], stopReason: 'tool_use' }),
    ),
    streamedText('Ich finde die Bewerbung nicht.'),
  )

  const response = await send(id, 'Lies meine Bewerbung')

  expect(model.requests.map((r) => r.tool_choice)).toEqual([
    { type: 'auto' },
    { type: 'auto' },
    { type: 'auto' },
    { type: 'auto' },
    { type: 'none' },
  ])
  const last = model.requests[4].messages.at(-1)!.content as { type: string; text?: string }[]
  expect(last.at(-1)).toEqual({ type: 'text', text: coachPrompt.LAST_ROUND })
  expect(events(response.text).at(-1)!.data).toMatchObject({ message: { text: 'Ich finde die Bewerbung nicht.' } })
})

test('a tool call in the last round is an error', async () => {
  const id = await newConversation()
  model.answer(streamed({ content: [toolUse('toolu_1', { application_id: 999999 })], stopReason: 'tool_use' }))

  const response = await send(id, 'Lies meine Bewerbung')

  expect(model.requests).toHaveLength(5)
  expect(events(response.text).at(-1)!.event).toBe('error')
})

test('every round of a turn sends the same tools', async () => {
  const own = await application()
  const id = await newConversation()
  model.answer(
    streamed({ content: [toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamed({ content: [toolUse('toolu_2', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Fertig.'),
  )

  await send(id, 'Bereite mich auf Kreditwerk vor')

  expect(model.requests).toHaveLength(3)
  expect(model.requests.map((r) => r.tools)).toEqual([TOOLS, TOOLS, TOOLS])
  expect(TOOLS).toHaveLength(1)
  expect(TOOLS[0]).toMatchObject({ name: 'get_application' })
  expect(model.requests[2].messages).toHaveLength(9)
})

test('all rounds of a turn share one prefix and the next turn gets a new mark', async () => {
  const own = await application()
  const id = await newConversation()
  const thinking: ContentBlock = { type: 'thinking', thinking: 'Notiz', signature: 'sig' }
  model.answer(
    streamed({ content: [thinking, toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamed({ content: [thinking, toolUse('toolu_2', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Fertig.'),
  )

  await send(id, 'Bereite mich auf Kreditwerk vor')

  const [first, second, third] = model.requests
  for (const [before, after] of [
    [first, second],
    [second, third],
  ]) {
    expect(after.system).toEqual(before.system)
    expect(after.tools).toEqual(before.tools)
    expect(after.messages.slice(0, before.messages.length)).toEqual(before.messages)
  }
  expect(third.messages.at(-2)!.content).toContainEqual(thinking)
  expect(third.messages.at(-1)!.content).toContainEqual({ type: 'text', text: coachPrompt.NEXT_ROUND })
  const mark = (params: MessageCreateParamsNonStreaming) => /<bewerbungen-([0-9a-f]{8}) /u.exec(applicantFile(params))?.[1]
  expect(mark(third)).toBe(mark(first))

  model.answer(streamedText('Gern.'))
  await send(id, 'Danke')

  expect(mark(model.requests.at(-1)!)).toMatch(/^[0-9a-f]{8}$/u)
  expect(mark(model.requests.at(-1)!)).not.toBe(mark(first))
})

function research(userId: number, conversationId: number, company: string, confirmedAt: Date | null, content = `Bericht zu ${company}`) {
  return prisma.companyResearch.create({
    data: {
      userId,
      conversationId,
      company,
      question: 'Wie groß ist die Firma?',
      content,
      sources: [{ url: 'https://kreditwerk.de/ueber-uns', title: 'Über uns' }],
      suspiciousText: 'Geheimer Verdacht',
      suspiciousSources: [],
      steps: [],
      queries: [],
      searchResults: [],
      confirmedAt,
    },
  })
}

test('the coach reads only the newest confirmed researches of this conversation', async () => {
  const id = await newConversation()
  const other = await newConversation()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const day = (n: number) => new Date(Date.UTC(2026, 10, n))
  await research(annaId, id, 'Firma Vier', day(4))
  await research(annaId, id, 'Firma Eins', day(1))
  await research(annaId, id, 'Firma Fünf', day(5))
  await research(annaId, id, 'Firma Drei', day(3))
  await research(annaId, id, 'Firma Offen', null)
  await research(annaId, other, 'Firma Anderes Gespräch', day(6))
  await research(ben.id, id, 'Firma Ben', day(6))

  await send(id, 'Was weißt du über die Firmen?')

  const file = applicantFile(model.requests[0])
  const companies = [...file.matchAll(/^Firma: (.+)$/gmu)].map(([, company]) => company)
  expect(companies).toHaveLength(coachConfig.RESEARCH_LIMIT)
  expect(companies).toEqual(['Firma Fünf', 'Firma Vier', 'Firma Drei'])
  expect(JSON.stringify(model.requests[0])).not.toContain('Geheimer Verdacht')
})

test('each turn reads the researches confirmed so far', async () => {
  const id = await newConversation()
  const open = await research(annaId, id, 'Firma Offen', null)
  await send(id, 'Hallo')
  expect(applicantFile(model.requests[0])).not.toContain('Firma Offen')

  await prisma.companyResearch.update({ where: { id: open.id }, data: { confirmedAt: new Date() } })
  await send(id, 'Und jetzt?')

  expect(applicantFile(model.requests[1])).toContain('Firma: Firma Offen')
})

test('a turn logs the research hits without any wording', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const id = await newConversation()
  await research(annaId, id, 'Firma Eins', new Date(), 'Siehe https://fremd.example/x und <recherche>')

  await send(id, 'Hallo')

  const line = info.mock.calls.map(([message]) => String(message)).join('\n')
  expect(line).toContain(`Coach turn in conversation ${id}`)
  expect(line).toContain('2 research hits')
  expect(line).not.toContain('fremd.example')
  expect(line).not.toContain('Firma Eins')
})

test('an old empty answer keeps its stop reason and is left out of the history', async () => {
  const id = await newConversation()
  await prisma.message.create({ data: { conversationId: id, role: 'user', content: [{ type: 'text', text: 'Was macht Kreditwerk?' }] } })
  await prisma.message.create({
    data: { conversationId: id, role: 'assistant', content: [{ type: 'text', text: 'Kredite.' }], stopReason: 'end_turn' },
  })
  await prisma.message.create({ data: { conversationId: id, role: 'user', content: [{ type: 'text', text: 'Und sonst?' }] } })
  await prisma.message.create({ data: { conversationId: id, role: 'assistant', content: [], stopReason: 'pause_turn' } })

  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)
  await send(id, 'Und jetzt?')

  expect((show.body as { messages: unknown[] }).messages.slice(1)).toMatchObject([
    { stop_reason: 'end_turn' },
    {},
    { text: '', steps: [], stop_reason: 'pause_turn' },
  ])
  expect(model.requests.at(-1)!.messages.slice(0, 3).map((m) => m.content)).toEqual([
    'Was macht Kreditwerk?',
    'Kredite.',
    'Und sonst?',
  ])
})

test('an earlier turn with tools goes to the model as text only', async () => {
  const own = await application()
  const id = await newConversation()
  model.answer(
    streamed({ content: [text('Moment. '), toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Hier die Fragen.'),
  )
  await send(id, 'Interviewfragen bitte')
  model.answer(streamedText('Gern.'))

  await send(id, 'Danke')

  expect(model.requests.at(-1)!.messages.slice(0, 2)).toEqual([
    { role: 'user', content: 'Interviewfragen bitte' },
    { role: 'assistant', content: 'Moment. Hier die Fragen.' },
  ])
})

test('every answer is a run with model, effort and tokens', async () => {
  const id = await newConversation()

  await send(id, 'Was kannst du?')

  expect(await prisma.llmRun.findMany()).toEqual([
    expect.objectContaining({
      userId: annaId,
      unit: 'coach_agent',
      status: 'ready',
      model: coachConfig.MODEL,
      effort: 'medium',
      inputTokens: 120,
      outputTokens: 30,
    }),
  ])
})

test('a failed answer is a failed run', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  model.answer(() => Promise.reject(new Error('overloaded')))
  const id = await newConversation()

  await send(id, 'Hallo')

  expect(await prisma.llmRun.findFirstOrThrow()).toMatchObject({ unit: 'coach_agent', status: 'failed' })
})

test('the coach answers at most fifty times a day and keeps the question for a retry', async () => {
  const id = await newConversation()
  const yesterday = new Date(Date.now() - 86_400_000)
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  const runs = (userId: number, createdAt?: Date) =>
    Array.from({ length: RUNS_PER_DAY.coach_agent }, () => ({ userId, unit: 'coach_agent' as const, createdAt }))
  await prisma.llmRun.createMany({ data: [...runs(annaId, yesterday), ...runs(ben.id)] })
  await prisma.llmRun.createMany({ data: runs(annaId).slice(1) })

  expect((await send(id, 'Erste Frage')).status).toBe(200)
  const response = await send(id, 'Zweite Frage')

  expect(response.status).toBe(429)
  expect(response.body).toEqual({ detail: 'limit_reached' })
  expect(model.requests).toHaveLength(1)
  const show = await request(app).get(`/api/v1/coach/conversations/${id}`).set(headers)
  expect((show.body as { messages: { text: string }[] }).messages.at(-1)).toMatchObject({ role: 'user', text: 'Zweite Frage' })
  expect((await retry(id)).status).toBe(429)
})
