import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../src/api'
import { useApplicationsStore } from '../src/stores/applications'

const JOB = { id: 7, source: 'ba', title: 'Frontend-Entwicklerin', company: 'Mediahaus GmbH', city: 'Berlin' }

const APPLICATION = {
  id: 3,
  status: 'saved',
  created_at: '2026-10-05T09:30:00Z',
  match_score: 68,
  job: { ...JOB, offer_type: 'work', full_time: true, part_time: false },
  history: [{ status: 'saved', changed_at: '2026-10-05T09:30:00Z' }],
  notes: [{ id: 1, content: 'Anschreiben gesendet.', created_at: '2026-10-08T14:05:00Z' }],
}

const SUMMARY = {
  id: 3,
  status: 'saved',
  created_at: '2026-10-05T09:30:00Z',
  applied_at: null,
  changed_at: '2026-10-05T09:30:00Z',
  notes: 1,
  match_score: 68,
  job: JOB,
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

test('the list is loaded with the token', async () => {
  const fetch = vi.fn().mockResolvedValue(json([SUMMARY]))
  vi.stubGlobal('fetch', fetch)
  const applications = useApplicationsStore()

  await applications.loadList()

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/applications')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  expect(applications.list).toEqual([SUMMARY])
})

test('creating posts the job and keeps the new application', async () => {
  const fetch = vi.fn().mockResolvedValue(json(APPLICATION, 201))
  vi.stubGlobal('fetch', fetch)
  const applications = useApplicationsStore()

  const created = await applications.create(7)

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/applications')
  expect(init.method).toBe('POST')
  expect(init.body).toBe(JSON.stringify({ job_id: 7 }))
  expect(created).toEqual(APPLICATION)
  expect(applications.application).toEqual(APPLICATION)
})

test('a status change patches the status and takes the new history', async () => {
  const applied = {
    ...APPLICATION,
    status: 'applied',
    history: [{ status: 'applied', changed_at: '2026-10-08T14:00:00Z' }, ...APPLICATION.history],
  }
  const fetch = vi.fn().mockResolvedValueOnce(json(APPLICATION)).mockResolvedValueOnce(json(applied))
  vi.stubGlobal('fetch', fetch)
  const applications = useApplicationsStore()
  await applications.load(3)

  await applications.setStatus(3, 'applied')

  const [url, init] = fetch.mock.calls[1] as [string, RequestInit]
  expect(url).toBe('/api/v1/applications/3')
  expect(init.method).toBe('PATCH')
  expect(init.body).toBe(JSON.stringify({ status: 'applied' }))
  expect(applications.application).toEqual(applied)
})

test('a new note is put on top of the open application', async () => {
  const note = { id: 2, content: 'Gespräch am Donnerstag.', created_at: '2026-10-20T17:20:00Z' }
  const fetch = vi.fn().mockResolvedValueOnce(json(APPLICATION)).mockResolvedValueOnce(json(note, 201))
  vi.stubGlobal('fetch', fetch)
  const applications = useApplicationsStore()
  await applications.load(3)

  await applications.addNote(3, 'Gespräch am Donnerstag.')

  const [url, init] = fetch.mock.calls[1] as [string, RequestInit]
  expect(url).toBe('/api/v1/applications/3/notes')
  expect(init.body).toBe(JSON.stringify({ content: 'Gespräch am Donnerstag.' }))
  expect(applications.application?.notes.map((entry) => entry.id)).toEqual([2, 1])
})

test('a failed status change keeps the application and throws the status', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(APPLICATION))
    .mockResolvedValueOnce(json({ detail: 'Application not found' }, 404))
  vi.stubGlobal('fetch', fetch)
  const applications = useApplicationsStore()
  await applications.load(3)

  await expect(applications.setStatus(3, 'offer')).rejects.toEqual(new ApiError(404, 'Application not found'))
  expect(applications.application).toEqual(APPLICATION)
})
