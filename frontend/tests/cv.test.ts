import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from '../src/api'
import { useCvStore } from '../src/stores/cv'

const VERSION = { id: 3, status: 'running', error: null, role: null, analysis: null, created_at: '2026-10-15T10:00:00Z' }

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

test('the upload sends the PDF as raw body', async () => {
  const fetch = vi.fn().mockResolvedValue(json(VERSION, 201))
  vi.stubGlobal('fetch', fetch)
  const cv = useCvStore()
  const file = new File(['%PDF-1.7'], 'lebenslauf.pdf', { type: 'application/pdf' })

  await cv.upload(file)

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/cvs')
  expect(init.method).toBe('POST')
  expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/pdf')
  expect(init.body).toBeInstanceOf(Blob)
  expect(await (init.body as Blob).text()).toBe('%PDF-1.7')
  expect(cv.version).toEqual(VERSION)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('without a CV the active version is empty', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'No CV uploaded' }, 404)))
  const cv = useCvStore()
  cv.version = { ...VERSION, status: 'running' }

  await cv.loadActive()

  expect(cv.version).toBeNull()
})

test('other errors while loading are thrown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'x' }, 500)))
  const cv = useCvStore()

  await expect(cv.loadActive()).rejects.toBeInstanceOf(ApiError)
})

test('confirming the role patches the active version', async () => {
  const fetch = vi.fn().mockResolvedValue(json({ ...VERSION, status: 'ready', role: 'Data' }))
  vi.stubGlobal('fetch', fetch)
  const cv = useCvStore()
  cv.version = { ...VERSION, status: 'ready' }

  await cv.confirmRole('Data')

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/cvs/3')
  expect(init.method).toBe('PATCH')
  expect(JSON.parse(init.body as string)).toEqual({ role: 'Data' })
  expect(cv.version?.role).toBe('Data')
})

test('the versions are loaded as list', async () => {
  const list = [
    { id: 3, status: 'running', error: null, role: null, active: true, created_at: '2026-10-15T10:00:00Z' },
    { id: 2, status: 'ready', error: null, role: 'Data', active: false, created_at: '2026-10-14T10:00:00Z' },
  ]
  const fetch = vi.fn().mockResolvedValue(json(list))
  vi.stubGlobal('fetch', fetch)
  const cv = useCvStore()

  await cv.loadVersions()

  expect((fetch.mock.calls[0] as [string])[0]).toBe('/api/v1/cvs')
  expect(cv.versions).toEqual(list)
})

test('activating an old version makes it the active one', async () => {
  const ready = { ...VERSION, id: 2, status: 'ready', role: 'Data' }
  const fetch = vi.fn().mockResolvedValue(json(ready))
  vi.stubGlobal('fetch', fetch)
  const cv = useCvStore()
  cv.version = { ...VERSION, status: 'running' }

  await cv.activate(2)

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/cvs/2/activation')
  expect(init.method).toBe('POST')
  expect(cv.version).toEqual(ready)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('deleting a version removes it from the list', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  const cv = useCvStore()
  cv.versions = [
    { id: 3, status: 'running', error: null, role: null, active: true, created_at: '' },
    { id: 2, status: 'ready', error: null, role: null, active: false, created_at: '' },
  ]

  await cv.remove(2)

  const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/cvs/2')
  expect(init.method).toBe('DELETE')
  expect(cv.versions.map((entry) => entry.id)).toEqual([3])
})

test('a failed delete keeps the version and throws', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'x' }, 409)))
  const cv = useCvStore()
  cv.versions = [{ id: 2, status: 'ready', error: null, role: null, active: false, created_at: '' }]

  await expect(cv.remove(2)).rejects.toBeInstanceOf(ApiError)
  expect(cv.versions).toHaveLength(1)
})
