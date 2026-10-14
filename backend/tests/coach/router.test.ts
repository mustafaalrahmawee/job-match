import request from 'supertest'
import { beforeEach, expect, test } from 'vitest'
import { COACH_CHAT_MODEL, COACH_CHAT_SYSTEM } from '../../src/prompts/coach_chat.js'
import { bearerFor, createAnna, streamedText, useTestDatabase } from '../helpers.js'

const { app, auth, prisma, model } = useTestDatabase()
let headers: { Authorization: string }

type SseEvent = { event: string; data: Record<string, unknown> }

const SETTINGS = { quality: 'normal', effort: 'low' }

beforeEach(async () => {
  headers = await bearerFor(auth, await createAnna(auth))
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
    model: COACH_CHAT_MODEL,
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
  expect(last).toMatchObject({
    model: COACH_CHAT_MODEL,
    system: COACH_CHAT_SYSTEM,
  })
  expect(last.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
  expect(last.messages.at(-1)!.content).toEqual([
    { type: 'text', text: 'Und wie lang soll ein Anschreiben sein?' },
  ])
})

test('quality and effort reach the request and are stored with the answer', async () => {
  const id = await newConversation()
  const cases = [
    [{ quality: 'normal', effort: 'low' }, { type: 'between_tools' }, 'medium'],
    [{ quality: 'normal', effort: 'high' }, { type: 'between_tools' }, 'high'],
    [{ quality: 'extended', effort: 'low' }, { type: 'adaptive' }, 'medium'],
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
    { quality: 'max', effort: 'low' },
    { quality: 'normal', effort: 'medium' },
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
  expect(model.requests.at(-1)!.messages).toHaveLength(1)

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
  for (const stopReason of ['tool_use', 'pause_turn', 'stop_sequence'] as const) {
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
