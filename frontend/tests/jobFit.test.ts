import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppSidebar from '../src/components/AppSidebar.vue'
import JobRow from '../src/components/JobRow.vue'
import { useAuthStore } from '../src/stores/auth'
import { useJobsStore } from '../src/stores/jobs'
import JobFitView from '../src/views/JobFitView.vue'

const POOL = {
  id: 1,
  source: 'ba',
  title: 'Backend-Entwicklerin',
  company: 'Werkbank GmbH',
  city: 'Kiel',
  region: null,
  offer_type: 'work',
  role: 'Backend',
  full_time: true,
  part_time: false,
  published_at: '2026-11-10',
}

const OWN = { ...POOL, id: 2, source: 'own', title: 'Eigene Anzeige', role: null }

const VERSION = { id: 5, status: 'ready', role: 'Backend', created_at: '2026-11-01T10:00:00Z' }

const LIST = { cv_version: { id: 5, created_at: '2026-11-01T10:00:00Z' }, jobs: [POOL, OWN] }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

type Answer = (url: string, init?: RequestInit) => Response

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/jobs/fit', component: JobFitView },
      { path: '/:other(.*)', component: { template: '<p>Andere Seite</p>' } },
    ],
  })
}

async function mountFit(answer: Answer, version: unknown = VERSION) {
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/cvs/active') return Promise.resolve(json(version))
    return Promise.resolve(answer(url, init))
  })
  vi.stubGlobal('fetch', fetch)
  const router = testRouter()
  await router.push('/jobs/fit')
  const wrapper = mount(JobFitView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, fetch }
}

function listCalls(fetch: ReturnType<typeof vi.fn>): string[] {
  return fetch.mock.calls.map(([url]) => url as string).filter((url) => url.startsWith('/api/v1/search/jobs'))
}

function button(wrapper: Awaited<ReturnType<typeof mountFit>>['wrapper'], text: string) {
  return wrapper.findAll('button').find((entry) => entry.text() === text)!
}

beforeEach(() => {
  localStorage.setItem('token', 'abc')
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

test('the page starts with the confirmed role of the active version', async () => {
  const { wrapper, fetch } = await mountFit(() => json(LIST))

  expect(listCalls(fetch)).toEqual(['/api/v1/search/jobs?role=Backend'])
  expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('Backend')
  expect(wrapper.text()).toContain('Verglichen mit deinem Lebenslauf vom 01.11.2026')
  expect(wrapper.text()).toContain('Eigene Stellen erscheinen bei jeder Rolle.')
})

test('without a confirmed role the page starts with all roles', async () => {
  const { fetch } = await mountFit(() => json(LIST), { ...VERSION, role: null })
  expect(listCalls(fetch)).toEqual(['/api/v1/search/jobs'])
})

test('changing the role aborts the running request and asks again', async () => {
  const signals: AbortSignal[] = []
  const { wrapper, fetch } = await mountFit((_url, init) => {
    signals.push(init!.signal!)
    return json(LIST)
  })

  await wrapper.find('select').setValue('Frontend')
  await wrapper.find('select').setValue('Data')
  await flushPromises()

  expect(listCalls(fetch).slice(-2)).toEqual(['/api/v1/search/jobs?role=Frontend', '/api/v1/search/jobs?role=Data'])
  expect(signals.at(-2)!.aborted).toBe(true)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

test('every row names its source and no similarity is shown', async () => {
  const { wrapper } = await mountFit(() => json(LIST))
  const rows = wrapper.findAll('li')
  expect(rows[0].text()).toContain('Bundesagentur')
  expect(rows[1].text()).toContain('Eigene Stelle')
  expect(wrapper.text()).not.toMatch(/\d+ ?%|Ähnlichkeit/u)
})

test('without an analysed CV the page points to the CV', async () => {
  const { wrapper } = await mountFit(() => json({ detail: 'no_cv' }, 409))
  expect(wrapper.text()).toContain('Noch kein analysierter Lebenslauf')
  expect(wrapper.find('a[href="/cv"]').text()).toBe('Zum Lebenslauf')
})

test('a CV not yet prepared can be prepared again by activating the active version', async () => {
  let prepared = false
  const { wrapper, fetch } = await mountFit((url, init) => {
    if (url === '/api/v1/cvs/5/activation' && init?.method === 'POST') {
      prepared = true
      return json(VERSION)
    }
    return prepared ? json(LIST) : json({ detail: 'not_embedded' }, 409)
  })
  expect(wrapper.text()).toContain('Dein Lebenslauf ist für den Vergleich noch nicht vorbereitet.')
  expect(wrapper.find('a[href="/jobs"]').exists()).toBe(true)

  await button(wrapper, 'Erneut versuchen').trigger('click')
  await flushPromises()

  const urls = fetch.mock.calls.map(([url]) => url as string)
  expect(urls.indexOf('/api/v1/cvs/5/activation')).toBeLessThan(urls.lastIndexOf('/api/v1/search/jobs?role=Backend'))
  expect(wrapper.findAll('li')).toHaveLength(2)
})

test('a CV still not prepared after the retry gets its own message', async () => {
  const { wrapper } = await mountFit((url) =>
    url.endsWith('/activation') ? json(VERSION) : json({ detail: 'not_embedded' }, 409),
  )
  await button(wrapper, 'Erneut versuchen').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Das hat nicht geklappt. Versuche es später noch einmal oder sieh dir alle Stellen an.')
  expect(wrapper.find('a[href="/jobs"]').exists()).toBe(true)
})

test('an unavailable service can be tried again', async () => {
  let calls = 0
  const { wrapper } = await mountFit(() => (++calls === 1 ? json({ detail: 'unavailable' }, 502) : json(LIST)))
  expect(wrapper.text()).toContain('Dienst gerade nicht erreichbar.')

  await button(wrapper, 'Erneut versuchen').trigger('click')
  await flushPromises()

  expect(wrapper.findAll('li')).toHaveLength(2)
})

test('another error has its own message', async () => {
  const { wrapper } = await mountFit(() => json({ detail: 'Internal server error' }, 500))
  expect(wrapper.text()).toContain('Die passenden Stellen konnten nicht geladen werden.')
})

test('an empty list with a role offers all roles, which loads without role', async () => {
  const { wrapper, fetch } = await mountFit((url) =>
    json({ ...LIST, jobs: url.includes('role=') ? [] : [POOL] }),
  )
  expect(wrapper.text()).toContain('Keine Stellen für diese Rolle')

  await button(wrapper, 'Alle Rollen').trigger('click')
  await flushPromises()

  expect(listCalls(fetch).at(-1)).toBe('/api/v1/search/jobs')
  expect(wrapper.findAll('li')).toHaveLength(1)
})

test('an empty list without a role points to saving an own job', async () => {
  const { wrapper } = await mountFit(() => json({ ...LIST, jobs: [] }), { ...VERSION, role: null })
  expect(wrapper.text()).toContain('Gerade keine Stellen')
  expect(wrapper.find('a[href="/jobs/new"]').text()).toBe('Eigene Stelle speichern')
})

test('rows elsewhere show no source', () => {
  const router = testRouter()
  const wrapper = mount(JobRow, { props: { job: POOL as never }, global: { plugins: [router] } })
  expect(wrapper.text()).not.toMatch(/Bundesagentur|Eigene Stelle/u)
})

test('the store loads the list with the role and forgets it on logout', async () => {
  const fetch = vi.fn((url: string) =>
    Promise.resolve(url.startsWith('/api/v1/search/jobs') ? json(LIST) : url.endsWith('/logout') ? new Response(null, { status: 204 }) : json([])),
  )
  vi.stubGlobal('fetch', fetch)
  const jobs = useJobsStore()
  await jobs.loadFit('UX/UI')
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/search/jobs?role=UX%2FUI')
  expect(jobs.fit).toEqual(LIST)

  useAuthStore().user = { id: 1, email: 'anna@example.com' } as never
  const router = testRouter()
  await router.push('/jobs/fit')
  const wrapper = mount(AppSidebar, { global: { plugins: [router] } })
  await flushPromises()
  await wrapper.find('[aria-label="Abmelden"]').trigger('click')
  await flushPromises()

  expect(jobs.fit).toBeNull()
})
