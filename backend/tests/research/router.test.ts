import type { ContentBlock, TextBlock } from '@anthropic-ai/sdk/resources/messages'
import request from 'supertest'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SendResult } from '../../src/llm/send.js'
import { RESEARCH_RUNS_PER_DAY } from '../../src/modules/research/research.service.js'
import {
  COMPANY_RESEARCH_CONTINUATIONS,
  COMPANY_RESEARCH_EFFORT,
  COMPANY_RESEARCH_FIELD_MAX_CHARS,
  COMPANY_RESEARCH_MODEL,
  COMPANY_RESEARCH_TITLE_MAX_CHARS,
} from '../../src/prompts/company_research/company_research.config.js'
import { COMPANY_RESEARCH_TOOLS } from '../../src/prompts/company_research/company_research.tools.js'
import { bearerFor, createAnna, requestText, streamed, streamedText, useTestDatabase, type FakeReply } from '../helpers.js'

const { app, auth, prisma, model } = useTestDatabase()
let headers: { Authorization: string }
let annaId: number
let conversationId: number

type SseEvent = { event: string; data: Record<string, unknown> }

type Research = {
  id: number
  text: string
  steps: unknown[]
  sources: { url: string; title: string | null }[]
  suspicious_text: string | null
  suspicious_sources: { url: string; title: string | null }[]
  confirmed_at: string | null
}

const FORM = { company: 'Kreditwerk GmbH, Kiel', question: 'Wie groß ist die Firma?' }

const WORDING = ['Kreditwerk', 'Wie groß', 'Laut', 'Geheimtext']

const CITATION = {
  type: 'web_search_result_location' as const,
  url: 'https://kreditwerk.de/ueber-uns',
  title: 'Über uns',
  cited_text: 'Geheimtext',
  encrypted_index: 'x',
}

const search = (id: string, query: string): ContentBlock => ({
  type: 'server_tool_use',
  id,
  name: 'web_search',
  input: { query },
  caller: { type: 'direct' },
})

const hits = (id: string, url = CITATION.url): ContentBlock => ({
  type: 'web_search_tool_result',
  tool_use_id: id,
  content: [{ type: 'web_search_result', url, title: 'Über uns', encrypted_content: 'x', page_age: null }],
  caller: { type: 'direct' },
})

const answer = (text: string, citations: TextBlock['citations'] = [CITATION]): TextBlock => ({ type: 'text', text, citations })

const FOUND = [search('s1', 'Kreditwerk Größe'), hits('s1'), answer('<antwort>Kreditwerk in Kiel hat 80 Personen.</antwort>')]

const stopped = (stopReason: SendResult['stopReason'], content: ContentBlock[] = FOUND) => streamed({ content, stopReason, webSearches: 1 })

beforeEach(async () => {
  const anna = await createAnna(auth)
  annaId = anna.id
  headers = await bearerFor(auth, anna)
  const created = await prisma.conversation.create({ data: { userId: annaId, title: 'Bewerbung' } })
  conversationId = created.id
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
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

function run(id = conversationId, body: object = FORM) {
  return request(app).post(`/api/v1/research/conversations/${id}`).set(headers).send(body)
}

function done(response: { text: string }): { research: Research | null; outcome: string } {
  const last = events(response.text).at(-1)!
  expect(last.event).toBe('done')
  return last.data as { research: Research | null; outcome: string }
}

async function researched(reply: FakeReply = stopped('end_turn')): Promise<Research> {
  model.answer(reply)
  return done(await run()).research!
}

function runs() {
  return prisma.companyResearchRun.findMany({ orderBy: { id: 'asc' } })
}

function logged(): string {
  return [console.info, console.warn]
    .flatMap((log) => vi.mocked(log).mock.calls)
    .flat()
    .join('\n')
}

test('the routes need a login', async () => {
  const response = await request(app).get(`/api/v1/research/conversations/${conversationId}`)

  expect(response.status).toBe(401)
})

test('a finished research is saved unconfirmed and comes back with its steps and sources', async () => {
  model.answer(stopped('end_turn'))

  const response = await run()

  expect(response.status).toBe(200)
  expect(events(response.text).map((e) => e.event)).toEqual(['step', 'done'])
  expect(events(response.text)[0].data).toEqual({ kind: 'web_search', query: 'Kreditwerk Größe', sources: 1 })
  const { research, outcome } = done(response)
  expect(outcome).toBe('ready')
  expect(research).toMatchObject({
    company: FORM.company,
    question: FORM.question,
    text: 'Kreditwerk in Kiel hat 80 Personen.',
    steps: [{ kind: 'web_search', query: 'Kreditwerk Größe', sources: 1 }],
    sources: [{ url: CITATION.url, title: 'Über uns' }],
    suspicious_text: null,
    suspicious_sources: [],
    confirmed_at: null,
  })
  const stored = await prisma.companyResearch.findFirstOrThrow()
  expect(stored).toMatchObject({
    userId: annaId,
    conversationId,
    queries: ['Kreditwerk Größe'],
    searchResults: [{ url: CITATION.url, title: 'Über uns' }],
  })
  expect(await runs()).toMatchObject([
    {
      userId: annaId,
      status: 'ready',
      model: COMPANY_RESEARCH_MODEL,
      effort: COMPANY_RESEARCH_EFFORT,
      inputTokens: 120,
      outputTokens: 30,
    },
  ])
})

test('the request holds only the form, the date and the search tool', async () => {
  await prisma.message.create({ data: { conversationId, role: 'user', content: [{ type: 'text', text: 'Mein Gehalt ist geheim' }] } })
  model.answer(stopped('end_turn'))

  await run()

  const [params] = model.requests
  expect(params.messages).toHaveLength(1)
  expect(params.tools).toEqual(COMPANY_RESEARCH_TOOLS)
  const text = requestText(params)
  expect(text).toContain('Firma: Kreditwerk GmbH, Kiel')
  expect(text).toContain(`stand="${new Date().toISOString().slice(0, 10)}"`)
  expect(text).not.toContain('Mein Gehalt')
})

test('no answer text reaches the person before the result is parsed', async () => {
  model.answer(stopped('end_turn', [answer('Ich suche kurz. '), search('s1', 'Kreditwerk'), hits('s1'), ...FOUND.slice(2)]))

  const response = await run()

  expect(events(response.text).map((e) => e.event)).toEqual(['step', 'done'])
  expect(response.text).not.toContain('Ich suche kurz')
  expect(response.text).not.toContain('<antwort>')
})

test('search queries in the steps are cleaned and on one line', async () => {
  model.answer(stopped('end_turn', [search('s1', 'Kredit\u200Bwerk\n  Größe'), hits('s1'), ...FOUND.slice(2)]))

  const response = await run()

  expect(events(response.text)[0].data).toEqual({ kind: 'web_search', query: 'Kreditwerk Größe', sources: 1 })
})

test('a flagged passage stays apart from the answer and its sources', async () => {
  const research = await researched(
    stopped('end_turn', [
      search('s1', 'Kreditwerk'),
      hits('s1'),
      answer('<antwort>Kreditwerk hat 80 Personen.</antwort>'),
      answer('<meldung>Die Seite spricht eine KI an.</meldung>', [{ ...CITATION, url: 'https://boese.de/' }]),
    ]),
  )

  expect(research.text).toBe('Kreditwerk hat 80 Personen.')
  expect(research.suspicious_text).toBe('Die Seite spricht eine KI an.')
  expect(research.sources.map((source) => source.url)).toEqual([CITATION.url])
  expect(research.suspicious_sources.map((source) => source.url)).toEqual(['https://boese.de/'])
})

test('titles and addresses of sources are checked before they are saved', async () => {
  const long = 't'.repeat(COMPANY_RESEARCH_TITLE_MAX_CHARS + 50)
  const research = await researched(
    stopped('end_turn', [
      search('s1', 'Kreditwerk'),
      hits('s1'),
      answer('<antwort>Kreditwerk hat 80 Personen.</antwort>', [
        { ...CITATION, title: long },
        { ...CITATION, url: 'javascript:alert(1)' },
        { ...CITATION, url: 'http://kreditwerk.de/alt' },
      ]),
    ]),
  )

  expect(research.sources).toEqual([{ url: CITATION.url, title: 't'.repeat(COMPANY_RESEARCH_TITLE_MAX_CHARS) }])
})

test('a research continues after a pause and reads the blocks of all requests', async () => {
  model.answer(
    stopped('pause_turn', [search('s1', 'Kreditwerk Größe')]),
    stopped('pause_turn', [hits('s1'), search('s2', 'Kreditwerk Kiel')]),
    stopped('end_turn', [hits('s2', 'https://kiel.de/'), ...FOUND.slice(2)]),
  )

  const response = await run()

  expect(model.requests).toHaveLength(3)
  expect(model.requests[2].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant'])
  expect(model.requests[1].messages[1].content).toEqual([search('s1', 'Kreditwerk Größe')])
  expect(events(response.text).filter((e) => e.event === 'step').map((e) => e.data)).toEqual([
    { kind: 'web_search', query: 'Kreditwerk Größe', sources: 1 },
    { kind: 'web_search', query: 'Kreditwerk Kiel', sources: 1 },
  ])
  expect(done(response).outcome).toBe('ready')
  expect(await prisma.companyResearch.findFirstOrThrow()).toMatchObject({
    queries: ['Kreditwerk Größe', 'Kreditwerk Kiel'],
    searchResults: [
      { url: CITATION.url, title: 'Über uns' },
      { url: 'https://kiel.de/', title: 'Über uns' },
    ],
  })
  expect(await runs()).toMatchObject([{ status: 'ready', inputTokens: 360, outputTokens: 90 }])
})

test('a continuation only appends, so thinking blocks keep their prefix', async () => {
  const thinking: ContentBlock = { type: 'thinking', thinking: '', signature: 'sig' }
  model.answer(
    stopped('pause_turn', [thinking, search('s1', 'Kreditwerk')]),
    stopped('pause_turn', [hits('s1'), thinking, search('s2', 'Kreditwerk Kiel')]),
    stopped('end_turn', [hits('s2'), ...FOUND.slice(2)]),
  )

  await run()

  const [first, second, third] = model.requests
  for (const later of [second, third]) {
    expect(later.system).toEqual(first.system)
    expect(later.tools).toEqual(first.tools)
  }
  expect(second.messages.slice(0, first.messages.length)).toEqual(first.messages)
  expect(third.messages.slice(0, second.messages.length)).toEqual(second.messages)
  expect(second.messages[1].content).toContainEqual(thinking)
})

test('every research gets its own mark', async () => {
  model.answer(stopped('end_turn'))

  await run()
  await run()

  const marks = model.requests.map((params) => /<anfrage-([0-9a-f]{8}) /.exec(requestText(params))?.[1])
  expect(marks[0]).toBeTruthy()
  expect(marks[0]).not.toBe(marks[1])
})

test('a pause after the last continuation ends the research without a result', async () => {
  model.answer(stopped('pause_turn', [search('s1', 'Kreditwerk')]))

  const response = await run()

  expect(model.requests).toHaveLength(COMPANY_RESEARCH_CONTINUATIONS + 1)
  expect(done(response)).toEqual({ research: null, outcome: 'unfinished' })
  expect(events(response.text).filter((e) => e.event === 'step').map((e) => e.data)).toEqual([
    { kind: 'web_search', query: 'Kreditwerk', sources: null },
  ])
  expect(await prisma.companyResearch.count()).toBe(0)
  expect(await runs()).toMatchObject([{ status: 'failed' }])
  expect(logged()).toContain('ended with pause_turn')
})

test.each([
  ['max_tokens', 'unfinished'],
  ['model_context_window_exceeded', 'unfinished'],
  ['stopped', 'stopped'],
  ['refusal', 'refused'],
] as const)('stop reason %s saves nothing and counts the run', async (stopReason, outcome) => {
  model.answer(stopped(stopReason))

  const response = await run()

  expect(done(response)).toEqual({ research: null, outcome })
  expect(await prisma.companyResearch.count()).toBe(0)
  expect(await runs()).toMatchObject([{ status: 'failed', inputTokens: 120 }])
})

test.each([
  ['no structure', 'Kreditwerk hat 80 Personen.'],
  ['an empty answer', '<antwort> </antwort>'],
  ['an unknown element', '<antwort>Kreditwerk</antwort><meldung.en>Hinweis</meldung.en>'],
])('an end of turn with %s has no answer', async (_name, text) => {
  model.answer(stopped('end_turn', [search('s1', 'Kreditwerk'), hits('s1'), answer(text)]))

  const response = await run()

  expect(done(response)).toEqual({ research: null, outcome: 'empty' })
  expect(await prisma.companyResearch.count()).toBe(0)
  expect(await runs()).toMatchObject([{ status: 'failed' }])
})

test('an unknown stop reason fails the research', async () => {
  model.answer(stopped('tool_use'))

  const response = await run()

  expect(events(response.text).at(-1)).toEqual({ event: 'error', data: { detail: 'The research failed' } })
  expect(await prisma.companyResearch.count()).toBe(0)
  expect(await runs()).toMatchObject([{ status: 'failed' }])
})

test('a failed request fails the research and counts the run', async () => {
  model.answer(() => Promise.reject(new Error('Anthropic down')))

  const response = await run()

  expect(events(response.text).at(-1)).toEqual({ event: 'error', data: { detail: 'The research failed' } })
  expect(await runs()).toMatchObject([{ status: 'failed' }])
})

test('a continuation over the budget fails the research, keeps the run counted and logs its counts', async () => {
  model.answer(streamed({ content: [answer('x'.repeat(3_000_000))], stopReason: 'pause_turn', webSearches: 4 }))

  const response = await run()

  expect(model.requests).toHaveLength(1)
  expect(events(response.text).at(-1)!.event).toBe('error')
  expect(await runs()).toMatchObject([{ status: 'failed', inputTokens: 120 }])
  expect(logged()).toContain('1 requests, 1 continuations, 120 input and 30 output tokens, 4 web searches')
  expect(logged()).toContain('4 web searches with 1 continuations')
})

test('a failed request logs the counts of the requests before it once', async () => {
  const replies = [stopped('pause_turn', [search('s1', 'Kreditwerk')]), () => Promise.reject(new Error('Anthropic down'))]
  model.answer(...replies)

  await run()

  expect(logged().match(/1 requests, 1 continuations/g)).toHaveLength(1)
})

test('the log has counts and no wording', async () => {
  model.answer(stopped('end_turn', [search('s1', 'Geheimtext Suche'), hits('s1'), ...FOUND.slice(2)]))

  await run()

  const lines = logged()
  expect(lines).toContain('1 requests, 0 continuations, 120 input and 30 output tokens, 1 web searches, 0 flagged, 1 queries without the company')
  for (const word of WORDING) expect(lines).not.toContain(word)
})

test('more searches than allowed raise a warning', async () => {
  model.answer(streamed({ content: FOUND, stopReason: 'end_turn', webSearches: 4 }))

  await run()

  expect(logged()).toContain('4 web searches with 0 continuations')
})

test.each([
  ['an empty company', { ...FORM, company: '   ' }],
  ['a question of invisible characters', { ...FORM, question: '\u200B\u{E0041}\uFE0F' }],
  ['a company that is too long', { ...FORM, company: 'x'.repeat(COMPANY_RESEARCH_FIELD_MAX_CHARS + 1) }],
  ['a missing question', { company: FORM.company }],
])('%s is refused before anything is counted', async (_name, body) => {
  const response = await run(conversationId, body)

  expect(response.status).toBe(422)
  expect(model.requests).toHaveLength(0)
  expect(await runs()).toHaveLength(0)
})

test('the field limit counts without invisible characters', async () => {
  model.answer(stopped('end_turn'))
  const company = `${'x'.repeat(COMPANY_RESEARCH_FIELD_MAX_CHARS)}\u200B`

  const response = await run(conversationId, { ...FORM, company })

  expect(response.status).toBe(200)
  expect(done(response).research).toMatchObject({ company: 'x'.repeat(COMPANY_RESEARCH_FIELD_MAX_CHARS) })
})

test('the daily limit counts every run and refuses the next one', async () => {
  for (let i = 0; i < RESEARCH_RUNS_PER_DAY; i++) {
    await prisma.companyResearchRun.create({
      data: { userId: annaId, model: COMPANY_RESEARCH_MODEL, status: i ? 'failed' : 'running' },
    })
  }

  const response = await run()

  expect(response.status).toBe(429)
  expect(response.body).toEqual({ detail: 'limit_reached' })
  expect(model.requests).toHaveLength(0)
  expect(await runs()).toHaveLength(RESEARCH_RUNS_PER_DAY)
})

test('runs of yesterday and of other people do not count', async () => {
  const other = await auth.createUser('ben@example.com', 'richtig-geheim')
  const yesterday = new Date(Date.now() - 86_400_000)
  for (let i = 0; i < RESEARCH_RUNS_PER_DAY; i++) {
    await prisma.companyResearchRun.create({ data: { userId: annaId, model: COMPANY_RESEARCH_MODEL, createdAt: yesterday } })
    await prisma.companyResearchRun.create({ data: { userId: other.id, model: COMPANY_RESEARCH_MODEL } })
  }
  model.answer(stopped('end_turn'))

  const response = await run()

  expect(response.status).toBe(200)
})

test('two runs at once cannot pass the daily limit', async () => {
  for (let i = 0; i < RESEARCH_RUNS_PER_DAY - 1; i++) {
    await prisma.companyResearchRun.create({ data: { userId: annaId, model: COMPANY_RESEARCH_MODEL } })
  }
  model.answer(stopped('end_turn'))

  const responses = await Promise.all([run(), run()])

  expect(responses.map((response) => response.status).sort()).toEqual([200, 429])
  expect(await runs()).toHaveLength(RESEARCH_RUNS_PER_DAY)
})

test('deleting a conversation removes its researches and keeps the runs counted', async () => {
  await researched()

  await request(app).delete(`/api/v1/coach/conversations/${conversationId}`).set(headers)

  expect(await prisma.companyResearch.count()).toBe(0)
  expect(await runs()).toHaveLength(1)
})

test('a foreign conversation behaves like a missing one', async () => {
  const other = await auth.createUser('ben@example.com', 'richtig-geheim')
  const foreign = await prisma.conversation.create({ data: { userId: other.id, title: 'Ben' } })

  const started = await run(foreign.id)
  const listed = await request(app).get(`/api/v1/research/conversations/${foreign.id}`).set(headers)

  expect(started.status).toBe(404)
  expect(listed.status).toBe(404)
  expect(model.requests).toHaveLength(0)
  expect(await runs()).toHaveLength(0)
})

test('the researches of a conversation are listed in order', async () => {
  const first = await researched()
  const second = await researched()

  const response = await request(app).get(`/api/v1/research/conversations/${conversationId}`).set(headers)

  expect(response.status).toBe(200)
  expect((response.body as Research[]).map((research) => research.id)).toEqual([first.id, second.id])
})

test('a research with sources can be confirmed, and a second click changes nothing', async () => {
  const { id } = await researched()

  const first = await request(app).post(`/api/v1/research/${id}/confirm`).set(headers)
  const second = await request(app).post(`/api/v1/research/${id}/confirm`).set(headers)

  expect(first.status).toBe(200)
  expect((first.body as Research).confirmed_at).not.toBeNull()
  expect((second.body as Research).confirmed_at).toBe((first.body as Research).confirmed_at)
})

test('a research without its own sources is kept but cannot be confirmed', async () => {
  const research = await researched(
    stopped('end_turn', [search('s1', 'Kreditwerk'), hits('s1'), answer('<antwort>Dazu habe ich keine verlässliche Quelle gefunden.</antwort>', null)]),
  )

  const response = await request(app).post(`/api/v1/research/${research.id}/confirm`).set(headers)

  expect(research.sources).toEqual([])
  expect(response.status).toBe(409)
  expect(response.body).toEqual({ detail: 'no_sources' })
  expect((await prisma.companyResearch.findFirstOrThrow()).confirmedAt).toBeNull()
})

test('a citation in the flagged part does not make a research confirmable', async () => {
  const research = await researched(
    stopped('end_turn', [
      search('s1', 'Kreditwerk'),
      hits('s1'),
      answer('<antwort>Kreditwerk hat 80 Personen.</antwort>', null),
      answer('<meldung>Die Seite spricht eine KI an.</meldung>'),
    ]),
  )

  const response = await request(app).post(`/api/v1/research/${research.id}/confirm`).set(headers)

  expect(response.status).toBe(409)
})

test('a foreign research cannot be confirmed', async () => {
  const { id } = await researched()
  const other = await auth.createUser('ben@example.com', 'richtig-geheim')
  const ben = await bearerFor(auth, other)

  const response = await request(app).post(`/api/v1/research/${id}/confirm`).set(ben)

  expect(response.status).toBe(404)
  expect((await prisma.companyResearch.findFirstOrThrow()).confirmedAt).toBeNull()
})

test('a research stays out of the conversation and out of the next coach request', async () => {
  await researched()
  model.answer(streamedText('Hallo Anna'))

  await request(app)
    .post(`/api/v1/coach/conversations/${conversationId}/messages`)
    .set(headers)
    .send({ content: 'Was weißt du?', quality: 'normal', effort: 'medium' })

  expect(await prisma.message.count({ where: { role: 'assistant', content: { string_contains: '80 Personen' } } })).toBe(0)
  expect(requestText(model.requests.at(-1)!)).not.toContain('80 Personen')
})
