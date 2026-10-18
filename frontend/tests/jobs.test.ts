import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../src/api'
import { useJobsStore } from '../src/stores/jobs'

const JOB = {
  id: 1,
  source: 'ba',
  title: 'Frontend-Entwicklerin (m/w/d)',
  company: 'Mediahaus GmbH',
  city: 'Berlin',
  region: 'BERLIN',
  offer_type: 'work',
  role: 'Frontend',
  full_time: true,
  part_time: false,
  published_at: '2026-10-15',
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

test('the list sends search and role and stores the page', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 3, pool_updated_at: '2026-10-17T06:00:00Z', jobs: [JOB] }))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()

  jobs.filter.q = '  Vue '
  jobs.filter.role = 'UX/UI'

  await jobs.load()

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/jobs?offset=0&limit=20&q=Vue&role=UX%2FUI')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  expect(jobs.jobs).toEqual([JOB])
  expect(jobs.total).toBe(3)
})

test('federal state, working time and offer type are sent with their API names', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 0, pool_updated_at: null, jobs: [] }))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()
  Object.assign(jobs.filter, { region: 'NORDRHEIN_WESTFALEN', workTime: 'part', offerType: 'apprenticeship' })

  await jobs.load()

  expect(fetch.mock.calls[0][0]).toBe(
    '/api/v1/jobs?offset=0&limit=20&region=NORDRHEIN_WESTFALEN&work_time=part&offer_type=apprenticeship',
  )
})

test('without a filter only offset and limit are sent', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 0, pool_updated_at: null, jobs: [] }))
  vi.stubGlobal('fetch', fetch)

  const jobs = useJobsStore()
  jobs.filter.q = ' '

  await jobs.load()

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/jobs?offset=0&limit=20')
})

test('a page asks for its offset and replaces the list', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 45, pool_updated_at: null, jobs: [{ ...JOB, id: 41 }] }))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()
  jobs.jobs = [JOB as never]

  jobs.filter.role = 'Frontend'

  await jobs.load(3)

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/jobs?offset=40&limit=20&role=Frontend')
  expect(jobs.jobs.map((job) => job.id)).toEqual([41])
  expect(jobs.total).toBe(45)
  expect(jobs.page).toBe(3)
})

test('a new filter replaces the list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 1, pool_updated_at: null, jobs: [{ ...JOB, id: 5 }] })))
  const jobs = useJobsStore()
  jobs.jobs = [JOB as never]

  await jobs.load()

  expect(jobs.jobs.map((job) => job.id)).toEqual([5])
})

test('errors are thrown to the view', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'x' }, 500)))

  await expect(useJobsStore().load()).rejects.toBeInstanceOf(ApiError)
})

test('a single job is loaded with its text', async () => {
  const detail = { ...JOB, description: '### Aufgaben', url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/x' }
  const fetch = vi.fn().mockResolvedValue(json(detail))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()

  await jobs.loadOne(1)

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/jobs/1')
  expect(jobs.job).toEqual(detail)
})

test('an unknown job leaves the detail empty and throws', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'Job not found' }, 404)))
  const jobs = useJobsStore()
  jobs.job = { ...JOB, description: 'alt', url: null } as never

  await expect(jobs.loadOne(9)).rejects.toBeInstanceOf(ApiError)
  expect(jobs.job).toBeNull()
})
