import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import type { ContentBlock, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import {
  COACH_AGENT_CV_RULES,
  COACH_AGENT_ERRORS,
  COACH_AGENT_LAST_ROUND,
  COACH_AGENT_MODEL,
  COACH_AGENT_NO_CV,
  COACH_AGENT_NO_MATCH,
  COACH_AGENT_REFOCUS,
  COACH_AGENT_SYSTEM,
  COACH_AGENT_TOOLS,
} from '../../src/prompts/coach_agent.js'
import type { CvAnalysis } from '../../src/prompts/cv_analysis.js'
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
  positions: [{ employer: 'Pixelwerk GmbH', title: 'Frontend-Entwicklerin', start: '2023-01', end: null }],
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
    model: COACH_AGENT_MODEL,
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
  expect(last.model).toBe(COACH_AGENT_MODEL)
  expect(requestText(last)).toContain(COACH_AGENT_SYSTEM)
  expect(requestText(last)).toContain(COACH_AGENT_NO_CV)
  expect(last.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
  expect(last.messages[0].content).toBe('Hallo')
  expect(last.messages.at(-1)!.content).toEqual([
    { type: 'text', text: expect.stringContaining('- keine Bewerbungen') as unknown },
    { type: 'text', text: 'Und wie lang soll ein Anschreiben sein?' },
    { type: 'text', text: COACH_AGENT_REFOCUS },
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
    data: { userId: annaId, pdf: new Uint8Array([1]), analysisStatus: 'ready', role: 'Backend', analysis: ANALYSIS },
  })
  const id = await newConversation()
  await send(id, 'Habe ich Kubernetes-Erfahrung?')

  const text = requestText(model.requests.at(-1)!)
  expect(text).toContain(COACH_AGENT_CV_RULES)
  for (const fact of [new Date().toISOString().slice(0, 10), 'Backend', 'Pixelwerk GmbH', 'Vue', 'TypeScript']) {
    expect(text).toContain(fact)
  }
})

test('a CV without a finished analysis, or an inactive one, leaves the coach without a CV', async () => {
  await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), isActive: false, analysisStatus: 'ready', analysis: ANALYSIS },
  })
  await prisma.cvVersion.create({ data: { userId: annaId, pdf: new Uint8Array([2]), analysisStatus: 'running' } })
  const id = await newConversation()
  await send(id, 'Kennst du meinen Lebenslauf?')

  const text = requestText(model.requests.at(-1)!)
  expect(text).toContain(COACH_AGENT_NO_CV)
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
  expect(model.requests.at(-1)!.messages).toEqual([
    {
      role: 'user',
      content: [
        { type: 'text', text: expect.stringContaining('<bewerbungen') as unknown },
        { type: 'text', text: 'Wie verhandle ich mein Gehalt?' },
        { type: 'text', text: COACH_AGENT_REFOCUS },
      ],
    },
  ])

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
  for (const stopReason of ['stop_sequence'] as const) {
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

function search(id: string, query: string): ContentBlock {
  return { type: 'server_tool_use', id, name: 'web_search', input: { query }, caller: { type: 'direct' } }
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
  return message.content as { type: string; tool_use_id: string; content: unknown; is_error?: boolean }[]
}

test('the coach gets the list of own applications with number, status and date', async () => {
  const own = await application()
  const ben = await auth.createUser('ben@example.com', 'auch-geheim')
  await application(ben.id, 'Bens Stelle')
  const id = await newConversation()

  await send(id, 'Welche Bewerbungen habe ich?')

  const list = (model.requests[0].messages.at(-1)!.content as { text: string }[])[0].text
  expect(list).toContain(`Bewerbung ${own.id}: Senior Frontend Engineer, Kreditwerk GmbH, Berlin; Status Gespeichert seit`)
  expect(list).not.toContain('Bens Stelle')
})

test('the coach reads an own application with ad and match and shows the step', async () => {
  const own = await application()
  const cv = await prisma.cvVersion.create({
    data: { userId: annaId, pdf: new Uint8Array([1]), analysisStatus: 'ready', role: 'Frontend', analysis: ANALYSIS },
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
  expect((show.body as { messages: unknown[] }).messages[1]).toMatchObject({ steps: [step], sources: [] })
})

test('an application without a match says so in the result', async () => {
  const own = await application()
  const id = await newConversation()
  model.answer(
    streamed({ content: [toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use' }),
    streamedText('Fragen aus der Anzeige.'),
  )

  await send(id, 'Interviewfragen bitte')

  expect(JSON.stringify(toolResults(model.requests[1].messages.at(-1)!)[0].content)).toContain(COACH_AGENT_NO_MATCH)
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
    ['toolu_1', COACH_AGENT_ERRORS.not_found, true],
    ['toolu_2', COACH_AGENT_ERRORS.not_found, true],
    ['toolu_3', COACH_AGENT_ERRORS.invalid_input, true],
    ['toolu_4', COACH_AGENT_ERRORS.unknown_tool, true],
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
  expect(last.at(-1)).toEqual({ type: 'text', text: COACH_AGENT_LAST_ROUND })
  expect(events(response.text).at(-1)!.data).toMatchObject({ message: { text: 'Ich finde die Bewerbung nicht.' } })
})

test('a tool call in the last round is an error', async () => {
  const id = await newConversation()
  model.answer(streamed({ content: [toolUse('toolu_1', { application_id: 999999 })], stopReason: 'tool_use' }))

  const response = await send(id, 'Lies meine Bewerbung')

  expect(model.requests).toHaveLength(5)
  expect(events(response.text).at(-1)!.event).toBe('error')
})

test('every round of a turn sends the same tools, with at most two web searches per request', async () => {
  const own = await application()
  const id = await newConversation()
  model.answer(
    streamed({ content: [toolUse('toolu_1', { application_id: own.id })], stopReason: 'tool_use', webSearches: 2 }),
    streamed({ content: [toolUse('toolu_2', { application_id: own.id })], stopReason: 'tool_use', webSearches: 2 }),
    streamedText('Fertig.'),
  )

  await send(id, 'Bereite mich auf Kreditwerk vor')

  expect(model.requests).toHaveLength(3)
  expect(model.requests.map((r) => r.tools)).toEqual([COACH_AGENT_TOOLS, COACH_AGENT_TOOLS, COACH_AGENT_TOOLS])
  expect(COACH_AGENT_TOOLS.at(-1)).toMatchObject({ name: 'web_search', max_uses: 2 })
  expect(model.requests[2].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
})
test('a paused answer is sent back unchanged and its text is kept', async () => {
  const id = await newConversation()
  const paused = [text('Ich schaue nach. '), search('srvtoolu_1', 'Kreditwerk')]
  model.answer(streamed({ content: paused, stopReason: 'pause_turn', webSearches: 2 }), streamedText('Kreditwerk baut Kredite.'))

  const response = await send(id, 'Was macht Kreditwerk?')

  expect(model.requests).toHaveLength(2)
  expect(model.requests[1].messages.at(-1)).toEqual({ role: 'assistant', content: paused })
  expect(model.requests[1].tool_choice).toEqual({ type: 'auto' })
  expect(events(response.text).at(-1)!.data).toMatchObject({
    stop_reason: 'end_turn',
    message: { text: 'Ich schaue nach. Kreditwerk baut Kredite.' },
  })
})

test('after two continuations a further pause ends the turn without a request', async () => {
  const id = await newConversation()
  const paused = [search('srvtoolu_1', 'Kreditwerk')]
  model.answer(streamed({ content: paused, stopReason: 'pause_turn', webSearches: 2 }))

  const response = await send(id, 'Was macht Kreditwerk?')

  expect(model.requests).toHaveLength(3)
  expect(model.requests[2].messages.slice(-2).map((m) => m.role)).toEqual(['assistant', 'assistant'])
  const unfinished = { kind: 'web_search', query: 'Kreditwerk', sources: null }
  expect(events(response.text).filter((e) => e.event === 'step').map((e) => e.data)).toEqual([unfinished])
  expect(events(response.text).at(-1)!.data).toMatchObject({
    stop_reason: 'pause_turn',
    message: { text: '', steps: [unfinished], stop_reason: 'pause_turn' },
  })
  model.answer(streamedText('Kreditwerk baut Kredite.'))
  const next = await send(id, 'Und jetzt?')
  expect(next.status).toBe(200)
  expect(model.requests.at(-1)!.messages.map((m) => m.role)).toEqual(['user', 'user'])
})

test('web searches become steps and their citations the sources of the answer', async () => {
  const id = await newConversation()
  const citation = (url: string) => ({
    type: 'web_search_result_location' as const,
    url,
    title: 'Kreditwerk',
    cited_text: 'Kredite',
    encrypted_index: 'x',
  })
  const result = (url: string) => ({ type: 'web_search_result' as const, url, title: 'Kreditwerk', encrypted_content: 'x', page_age: null })
  model.answer(
    streamed({
      content: [
        search('srvtoolu_1', 'Kreditwerk Berlin'),
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srvtoolu_1',
          content: [result('https://a.de'), result('https://b.de')],
          caller: { type: 'direct' },
        },
        search('srvtoolu_2', 'Kreditwerk Größe'),
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srvtoolu_2',
          content: { type: 'web_search_tool_result_error', error_code: 'unavailable' },
          caller: { type: 'direct' },
        },
        { type: 'text', text: 'Laut ihrer Seite baut Kreditwerk Kredite.', citations: [citation('https://a.de'), citation('https://a.de')] },
      ],
      stopReason: 'end_turn',
      webSearches: 2,
    }),
  )

  const response = await send(id, 'Was macht Kreditwerk?')

  const steps = [
    { kind: 'web_search', query: 'Kreditwerk Berlin', sources: 2 },
    { kind: 'web_search', query: 'Kreditwerk Größe', sources: null },
  ]
  const stream = events(response.text)
  expect(stream.filter((e) => e.event === 'step').map((e) => e.data)).toEqual(steps)
  expect(stream.at(-1)!.data).toMatchObject({
    message: { text: 'Laut ihrer Seite baut Kreditwerk Kredite.', steps, sources: [{ url: 'https://a.de', title: 'Kreditwerk' }] },
  })
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
