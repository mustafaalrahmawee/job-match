import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../src/api'
import { useInterviewsStore } from '../src/stores/interviews'

const TURN = {
  number: 1,
  title: 'Deployment',
  question: 'Wie deployst du?',
  gap: 'Kubernetes fehlt.',
  ad_quote: 'idealerweise Kubernetes',
  answer: null,
  skipped: false,
  score: null,
  good: null,
  better: null,
  area: null,
  line: null,
}

const SESSION = {
  id: 4,
  job: { id: 7, source: 'ba', title: 'Frontend-Entwicklerin', company: 'Mediahaus GmbH', city: 'Hamburg' },
  difficulty: 'medium',
  status: 'running',
  question_count: 8,
  pending: false,
  match_score: 68,
  created_at: '2026-10-25T10:00:00Z',
  updated_at: '2026-10-25T10:00:00Z',
  finished_at: null,
  turns: [TURN],
  report: null,
}

const GRADED = {
  ...SESSION,
  turns: [{ ...TURN, answer: 'Mit Helm.', score: 7, better: 'Nenne den Ingress.' }, { ...TURN, number: 2 }],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  localStorage.setItem('token', 'abc')
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

test('the list and one training are loaded', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json([SESSION])).mockResolvedValueOnce(json(SESSION))
  vi.stubGlobal('fetch', fetch)
  const interviews = useInterviewsStore()

  await interviews.loadList()
  await interviews.load(4)

  expect(fetch.mock.calls.map(([url]) => url as string)).toEqual(['/api/v1/interviews', '/api/v1/interviews/4'])
  expect(interviews.list).toEqual([SESSION])
  expect(interviews.current).toEqual(SESSION)
})

test('a start posts job and difficulty and keeps the new training', async () => {
  const fetch = vi.fn().mockResolvedValue(json(SESSION, 201))
  vi.stubGlobal('fetch', fetch)
  const interviews = useInterviewsStore()

  const session = await interviews.start(7, 'medium')

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/interviews')
  expect(init.method).toBe('POST')
  expect(init.body).toBe(JSON.stringify({ job_id: 7, difficulty: 'medium' }))
  expect(session).toEqual(SESSION)
  expect(interviews.current).toEqual(SESSION)
})

test('answer, skip and continue post to their step and keep the answer of the server', async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(json(GRADED)))
  vi.stubGlobal('fetch', fetch)
  const interviews = useInterviewsStore()

  await interviews.step(4, 'answer', { answer: 'Mit Helm.' })
  await interviews.step(4, 'skip')
  await interviews.step(4, 'continue')

  const calls = fetch.mock.calls as [string, RequestInit][]
  expect(calls.map(([url]) => url)).toEqual([
    '/api/v1/interviews/4/answer',
    '/api/v1/interviews/4/skip',
    '/api/v1/interviews/4/continue',
  ])
  expect(calls.every(([, init]) => init.method === 'POST')).toBe(true)
  expect(calls[0][1].body).toBe(JSON.stringify({ answer: 'Mit Helm.' }))
  expect(calls[1][1].body).toBeUndefined()
  expect(interviews.current).toEqual(GRADED)
})

test('a failed step reloads the training and throws the reason', async () => {
  const saved = { ...SESSION, pending: true, turns: [{ ...TURN, answer: 'Mit Helm.' }] }
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ detail: 'unavailable' }, 502))
    .mockResolvedValueOnce(json(saved))
  vi.stubGlobal('fetch', fetch)
  const interviews = useInterviewsStore()

  await expect(interviews.step(4, 'answer', { answer: 'Mit Helm.' })).rejects.toEqual(new ApiError(502, 'unavailable'))
  expect(fetch.mock.calls[1][0]).toBe('/api/v1/interviews/4')
  expect(interviews.current).toEqual(saved)
})
