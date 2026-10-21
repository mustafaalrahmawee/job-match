import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../src/api'
import { useMatchesStore } from '../src/stores/matches'

const RESULT = {
  id: 1,
  job_id: 7,
  score: 82,
  fit: 'Sehr gute Passung',
  strengths: [{ ad_quote: '3+ Jahre Vue', cv_quote: 'Vue 3', text: 'Vue 3 ist belegt.' }],
  gaps: [{ ad_quote: 'idealerweise Kubernetes', cv_quote: null, text: 'Kubernetes fehlt.' }],
  tips: [],
  archived: false,
  created_at: '2026-10-21T10:00:00Z',
  cv_version: { id: 3, role: 'Frontend', created_at: '2026-10-12T10:00:00Z' },
}

const OLD = { ...RESULT, id: 2, score: 71, archived: true, cv_version: { ...RESULT.cv_version, id: 2 } }

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

test('the overview of a job is loaded with its current and archived results', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ current: RESULT, archived: [OLD] }))
  vi.stubGlobal('fetch', fetch)
  const matches = useMatchesStore()

  await matches.load(7)

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/matches/jobs/7')
  expect(matches.current).toEqual(RESULT)
  expect(matches.archived).toEqual([OLD])
})

test('a run posts the job and keeps the new result', async () => {
  const fetch = vi.fn().mockResolvedValue(json(RESULT, 201))
  vi.stubGlobal('fetch', fetch)
  const matches = useMatchesStore()

  await matches.run(7)

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/matches')
  expect(init.method).toBe('POST')
  expect(init.body).toBe(JSON.stringify({ job_id: 7 }))
  expect(matches.current).toEqual(RESULT)
})

test('a result for a version that became inactive meanwhile reloads the overview', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ current: RESULT, archived: [] }))
    .mockResolvedValueOnce(json(OLD, 201))
    .mockResolvedValueOnce(json({ current: null, archived: [OLD, { ...RESULT, archived: true }] }))
  vi.stubGlobal('fetch', fetch)
  const matches = useMatchesStore()
  await matches.load(7)

  await matches.run(7)

  expect(fetch.mock.calls[2][0]).toBe('/api/v1/matches/jobs/7')
  expect(matches.current).toBeNull()
  expect(matches.archived).toEqual([OLD, { ...RESULT, archived: true }])
})

test('a failed run keeps the earlier result and throws the reason', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ current: RESULT, archived: [] }))
    .mockResolvedValueOnce(json({ detail: 'limit_reached' }, 429))
  vi.stubGlobal('fetch', fetch)
  const matches = useMatchesStore()
  await matches.load(7)

  await expect(matches.run(7)).rejects.toEqual(new ApiError(429, 'limit_reached'))
  expect(matches.current).toEqual(RESULT)
})

test('the list of all results of the active version is loaded', async () => {
  const entry = { ...RESULT, job: { id: 7, source: 'ba', title: 'Frontend-Entwicklerin', company: null, city: 'Berlin' } }
  const fetch = vi.fn().mockResolvedValue(json([entry]))
  vi.stubGlobal('fetch', fetch)
  const matches = useMatchesStore()

  await matches.loadList()

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/matches')
  expect(matches.list).toEqual([entry])
})
