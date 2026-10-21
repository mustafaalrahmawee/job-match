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
  expect(url).toBe('/api/v1/jobs?source=ba&offset=0&limit=20&q=Vue&role=UX%2FUI')
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
    '/api/v1/jobs?source=ba&offset=0&limit=20&region=NORDRHEIN_WESTFALEN&work_time=part&offer_type=apprenticeship',
  )
})

test('without a filter only offset and limit are sent', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 0, pool_updated_at: null, jobs: [] }))
  vi.stubGlobal('fetch', fetch)

  const jobs = useJobsStore()
  jobs.filter.q = ' '

  await jobs.load()

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/jobs?source=ba&offset=0&limit=20')
})

test('a page asks for its offset and replaces the list', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 45, pool_updated_at: null, jobs: [{ ...JOB, id: 41 }] }))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()
  jobs.jobs = [JOB as never]

  jobs.filter.role = 'Frontend'

  await jobs.load(3)

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/jobs?source=ba&offset=40&limit=20&role=Frontend')
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

test('the pool list asks only for pool jobs', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ total: 0, pool_updated_at: null, jobs: [] }))
  vi.stubGlobal('fetch', fetch)

  await useJobsStore().load()

  expect(new URL(fetch.mock.calls[0][0] as string, 'http://x').searchParams.get('source')).toBe('ba')
})

test('own jobs are loaded on their own and more are appended', async () => {
  const own = { ...JOB, source: 'own', role: null }
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ total: 2, pool_updated_at: null, jobs: [{ ...own, id: 1 }] }))
    .mockResolvedValueOnce(json({ total: 2, pool_updated_at: null, jobs: [{ ...own, id: 2 }] }))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()
  jobs.jobs = [JOB as never]

  await jobs.loadOwn()
  await jobs.loadOwn(1)

  expect(fetch.mock.calls[0][0]).toBe('/api/v1/jobs?source=own&offset=0&limit=20')
  expect(fetch.mock.calls[1][0]).toBe('/api/v1/jobs?source=own&offset=1&limit=20')
  expect(jobs.ownJobs.map((job) => job.id)).toEqual([1, 2])
  expect(jobs.ownTotal).toBe(2)
  expect(jobs.jobs).toEqual([JOB])
})

const DRAFT = {
  title: 'Senior Frontend Engineer',
  company: null,
  city: 'Berlin',
  offer_type: 'work',
  full_time: true,
  part_time: false,
  salary: null,
  description: 'Text der Anzeige',
}

test('pasted text is read out as JSON', async () => {
  const fetch = vi.fn().mockResolvedValue(json(DRAFT))
  vi.stubGlobal('fetch', fetch)

  const draft = await useJobsStore().extract('Text der Anzeige')

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/jobs/extraction')
  expect(init.method).toBe('POST')
  expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  expect(init.body).toBe(JSON.stringify({ text: 'Text der Anzeige' }))
  expect(draft).toEqual(DRAFT)
})

test('a screenshot is sent as the image itself', async () => {
  const fetch = vi.fn().mockResolvedValue(json(DRAFT))
  vi.stubGlobal('fetch', fetch)
  const file = new File(['bild'], 'anzeige.jpg', { type: 'image/jpeg' })

  await useJobsStore().extract(file)

  const [, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect((init.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg')
  expect(init.body).toBeInstanceOf(Blob)
})

test('a rejected ad carries the reason from the API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'not_job' }, 422)))

  const extract = useJobsStore().extract('Lebenslauf')

  await expect(extract).rejects.toBeInstanceOf(ApiError)
  await expect(extract).rejects.toMatchObject({ status: 422, detail: 'not_job' })
})

test('saving posts the checked form and keeps the new job', async () => {
  const detail = { ...JOB, id: 7, source: 'own', role: null, description: 'Text der Anzeige', salary: null, url: null }
  const fetch = vi.fn().mockResolvedValue(json(detail, 201))
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()
  const input = { ...DRAFT, company: '', salary: '' } as never

  const job = await jobs.create(input)

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/jobs')
  expect(init.method).toBe('POST')
  expect(init.body).toBe(JSON.stringify(input))
  expect(job.id).toBe(7)
  expect(jobs.job).toEqual(detail)
})
