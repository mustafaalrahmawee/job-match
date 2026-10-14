import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../src/api'
import { readEvents } from '../src/sse'
import { useCoachStore } from '../src/stores/coach'

function sse(...events: [string, unknown][]): string {
  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')
}

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part))
      controller.close()
    },
  })
}

function sseResponse(body: string): Response {
  return new Response(streamOf(body), { headers: { 'Content-Type': 'text/event-stream' } })
}

const DONE = {
  message: { id: 2, role: 'assistant', text: 'Hallo Anna', stop_reason: 'end_turn' },
  stop_reason: 'end_turn',
}

beforeEach(() => {
  localStorage.setItem('token', 'abc')
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

test('events split across chunks are read whole', async () => {
  const body = sse(['delta', { text: 'Hal' }], ['delta', { text: 'lo' }])
  const seen: [string, unknown][] = []

  await readEvents(streamOf(body.slice(0, 10), body.slice(10, 31), body.slice(31)), (e, d) => seen.push([e, d]))

  expect(seen).toEqual([
    ['delta', { text: 'Hal' }],
    ['delta', { text: 'lo' }],
  ])
})

test('the first message creates a conversation and streams the answer', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, title: '', messages: [] }), { status: 201 }))
    .mockResolvedValueOnce(sseResponse(sse(['delta', { text: 'Hallo ' }], ['delta', { text: 'Anna' }], ['done', DONE])))
  vi.stubGlobal('fetch', fetch)
  const coach = useCoachStore()

  await coach.send(`Hallo,\n  ich suche ${'eine Stelle '.repeat(10)}`)

  expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'POST', body: expect.any(String) })
  const { title } = JSON.parse(fetch.mock.calls[0]![1].body as string) as { title: string }
  expect(title).toHaveLength(60)
  expect(title.startsWith('Hallo, ich suche eine Stelle')).toBe(true)
  expect(fetch.mock.calls[1]![0]).toBe('/api/v1/coach/conversations/7/messages')
  expect(fetch.mock.calls[1]![1]).toMatchObject({
    method: 'POST',
    headers: { Authorization: 'Bearer abc' },
  })
  expect(coach.conversationId).toBe(7)
  expect(coach.messages.map((m) => [m.role, m.stopReason])).toEqual([
    ['user', null],
    ['assistant', 'end_turn'],
  ])
  expect(coach.messages[1]!.text).toBe('Hallo Anna')
  expect(coach.streaming).toBe(false)
  expect(coach.canRetry).toBe(false)
})

test('an error event drops the answer and offers a retry', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, title: '', messages: [] })))
    .mockResolvedValueOnce(sseResponse(sse(['delta', { text: 'Hal' }], ['error', { detail: 'x' }])))
    .mockResolvedValueOnce(sseResponse(sse(['done', DONE])))
  vi.stubGlobal('fetch', fetch)
  const coach = useCoachStore()

  await expect(coach.send('Hallo')).rejects.toBeInstanceOf(ApiError)
  expect(coach.messages).toHaveLength(1)
  expect(coach.canRetry).toBe(true)

  await expect(coach.retry()).resolves.toBe('end_turn')
  expect(fetch.mock.calls[2]![0]).toBe('/api/v1/coach/conversations/7/retry')
  expect(coach.messages.at(-1)!.text).toBe('Hallo Anna')
})

test('stop aborts the request and keeps the text so far', async () => {
  let push: (text: string) => void = () => undefined
  const fetch = vi.fn((_url: string, init: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (text) => controller.enqueue(new TextEncoder().encode(text))
        init.signal!.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
      },
    })
    return Promise.resolve(new Response(body))
  })
  vi.stubGlobal('fetch', fetch)
  const coach = useCoachStore()
  coach.conversationId = 7

  const sending = coach.send('Schreib was Langes')
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
  push(sse(['delta', { text: 'Erster Teil' }]))
  await vi.waitFor(() => expect(coach.messages.at(-1)!.text).toBe('Erster Teil'))
  coach.controller?.abort()
  await expect(sending).rejects.toMatchObject({ name: 'AbortError' })

  expect(coach.messages.at(-1)).toMatchObject({ role: 'assistant', text: 'Erster Teil', stopReason: 'stopped' })
  expect(coach.streaming).toBe(false)
})

test('loading a conversation shows its history', async () => {
  const body = {
    id: 3,
    title: 'Hallo',
    messages: [
      { id: 1, role: 'user', text: 'Hallo', stop_reason: null, created_at: '' },
      { id: 2, role: 'assistant', text: 'Hi', stop_reason: 'end_turn', created_at: '' },
    ],
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))
  const coach = useCoachStore()

  await coach.load(3)

  expect(coach.conversationId).toBe(3)
  expect(coach.messages.map((m) => m.text)).toEqual(['Hallo', 'Hi'])
})

test('the open conversation is remembered until a new one starts', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, title: '', messages: [] }), { status: 201 }))
      .mockResolvedValueOnce(sseResponse(sse(['done', DONE]))),
  )
  await useCoachStore().send('Hallo')

  setActivePinia(createPinia())
  const afterReload = useCoachStore()
  expect(afterReload.lastId()).toBe(7)

  afterReload.startNew()
  expect(afterReload.lastId()).toBeNull()
})

test('a remembered conversation that is gone is forgotten', async () => {
  localStorage.setItem('coach_conversation', '9')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
  const coach = useCoachStore()

  await expect(coach.load(9)).rejects.toMatchObject({ status: 404 })

  expect(coach.lastId()).toBeNull()
})

test('quality and effort go with every message and are remembered', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(sseResponse(sse(['error', { detail: 'x' }])))
    .mockResolvedValueOnce(sseResponse(sse(['done', DONE])))
  vi.stubGlobal('fetch', fetch)
  const coach = useCoachStore()
  coach.conversationId = 7
  expect([coach.quality, coach.effort]).toEqual(['normal', 'low'])

  await expect(coach.send('Hallo')).rejects.toBeInstanceOf(ApiError)
  coach.quality = 'extended'
  coach.effort = 'high'
  await coach.retry()

  expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({ content: 'Hallo', quality: 'normal', effort: 'low' })
  expect(JSON.parse(fetch.mock.calls[1]![1].body as string)).toEqual({ quality: 'extended', effort: 'high' })
  setActivePinia(createPinia())
  expect([useCoachStore().quality, useCoachStore().effort]).toEqual(['extended', 'high'])
})

test('conversations are listed, renamed and deleted', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 3, title: 'Gehalt' }, { id: 7, title: 'Hallo' }])))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, title: 'Anschreiben' })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  const coach = useCoachStore()
  coach.conversationId = 7

  await coach.loadList()
  await coach.rename(7, 'Anschreiben')
  expect(coach.conversations.map((c) => c.title)).toEqual(['Gehalt', 'Anschreiben'])
  expect(fetch.mock.calls[1]).toEqual([
    '/api/v1/coach/conversations/7',
    expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'Anschreiben' }) }),
  ])

  await coach.remove(7)
  expect(fetch.mock.calls[2]![1]).toMatchObject({ method: 'DELETE' })
  expect(coach.conversations.map((c) => c.id)).toEqual([3])
  expect(coach.conversationId).toBeNull()
  expect(coach.lastId()).toBeNull()
})
