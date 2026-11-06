import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError } from '../src/api'
import ResearchCard from '../src/components/ResearchCard.vue'
import ResearchForm from '../src/components/ResearchForm.vue'
import { useCoachStore } from '../src/stores/coach'
import { useResearchStore } from '../src/stores/research'
import type { Research } from '../src/types'
import CoachView from '../src/views/CoachView.vue'

const RESEARCH: Research = {
  id: 3,
  conversation_id: 7,
  company: 'Kreditwerk',
  question: 'Wie groß?',
  text: 'Kreditwerk hat 80 Personen.\n- Kiel\n- Hamburg',
  steps: [{ kind: 'web_search', query: 'Kreditwerk Größe', sources: 2 }],
  sources: [{ url: 'https://kreditwerk.de/', title: 'Über uns' }],
  suspicious_text: null,
  suspicious_sources: [],
  confirmed_at: null,
  created_at: '2026-11-06T10:00:00.000Z',
}

const FORM = { company: 'Kreditwerk', question: 'Wie groß?' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function sse(...events: [string, unknown][]): Response {
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

beforeEach(() => {
  localStorage.setItem('token', 'abc')
  setActivePinia(createPinia())
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

test('opening a conversation loads its researches', async () => {
  const fetch = vi.fn().mockResolvedValue(json([RESEARCH]))
  vi.stubGlobal('fetch', fetch)
  const research = useResearchStore()

  await research.open(7)
  await research.open(7)

  expect(fetch).toHaveBeenCalledOnce()
  expect(fetch.mock.calls[0]![0]).toBe('/api/v1/research/conversations/7')
  expect(research.items).toEqual([RESEARCH])
})

test('leaving a conversation clears its researches and ignores a late answer', async () => {
  let answer: (response: Response) => void = () => undefined
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => (answer = resolve))))
  const research = useResearchStore()

  const opening = research.open(7)
  await research.open(null)
  answer(json([RESEARCH]))
  await opening

  expect(research.items).toEqual([])
})

test('a late list keeps a result that came in while it was loading', async () => {
  let answer: (response: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
      .mockResolvedValueOnce(sse(['done', { research: RESEARCH, outcome: 'ready' }])),
  )
  const research = useResearchStore()
  useCoachStore().conversationId = 7

  const opening = research.open(7)
  await research.run(FORM)
  answer(json([{ ...RESEARCH, id: 1 }]))
  await opening

  expect(research.items.map((item) => item.id)).toEqual([1, 3])
})

test('switching the conversation while its list loads starts no run', async () => {
  let answer: (response: Response) => void = () => undefined
  const fetch = vi
    .fn()
    .mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    .mockResolvedValue(json([]))
  vi.stubGlobal('fetch', fetch)
  const research = useResearchStore()
  useCoachStore().conversationId = 7

  const started = research.run(FORM)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  await research.open(8)
  answer(json([]))

  expect(await started).toBeNull()
  expect(fetch.mock.calls.filter((call) => (call[1] as RequestInit).method === 'POST')).toHaveLength(0)
  expect(research.running).toBe(false)
})

test('a research without a conversation creates one, shows steps and adds the result', async () => {
  const seen: unknown[] = []
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ id: 7, title: 'Recherche: Kreditwerk', messages: [] }, 201))
    .mockResolvedValueOnce(json([]))
    .mockResolvedValueOnce(sse(['step', RESEARCH.steps[0]], ['done', { research: RESEARCH, outcome: 'ready' }]))
  vi.stubGlobal('fetch', fetch)
  const research = useResearchStore()
  const coach = useCoachStore()

  const started = research.run(FORM)
  seen.push(research.running)
  const outcome = await started

  expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({ title: 'Recherche: Kreditwerk' })
  expect(fetch.mock.calls[2]![0]).toBe('/api/v1/research/conversations/7')
  expect(JSON.parse(fetch.mock.calls[2]![1].body as string)).toEqual(FORM)
  expect(outcome).toBe('ready')
  expect(seen).toEqual([true])
  expect(coach.conversationId).toBe(7)
  expect(research.items).toEqual([RESEARCH])
  expect(research.running).toBe(false)
  expect(research.steps).toEqual([])
})

test('a result without an answer adds nothing and gives its outcome', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(['done', { research: null, outcome: 'unfinished' }])))
  const research = useResearchStore()
  useCoachStore().conversationId = 7
  research.conversationId = 7

  expect(await research.run(FORM)).toBe('unfinished')
  expect(research.items).toEqual([])
})

test('an error event and a stream without an end are thrown', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(sse(['error', { detail: 'x' }])).mockResolvedValueOnce(sse()))
  const research = useResearchStore()
  useCoachStore().conversationId = 7
  research.conversationId = 7

  await expect(research.run(FORM)).rejects.toBeInstanceOf(ApiError)
  await expect(research.run(FORM)).rejects.toBeInstanceOf(ApiError)
  expect(research.running).toBe(false)
})

test('the daily limit reaches the view as an error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'limit_reached' }, 429)))
  const research = useResearchStore()
  useCoachStore().conversationId = 7
  research.conversationId = 7

  await expect(research.run(FORM)).rejects.toMatchObject({ status: 429, detail: 'limit_reached' })
})

function hanging() {
  return vi.fn().mockImplementation(
    (_url: string, { signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
  )
}

test('stop ends the research as stopped', async () => {
  vi.stubGlobal('fetch', hanging())
  const research = useResearchStore()
  useCoachStore().conversationId = 7
  research.conversationId = 7

  const started = research.run(FORM)
  await vi.waitFor(() => expect(research.controller).not.toBeNull())
  research.controller!.abort()

  expect(await started).toBe('stopped')
  expect(research.running).toBe(false)
})

test('switching the conversation aborts the run without a message', async () => {
  const fetch = hanging()
  vi.stubGlobal('fetch', fetch)
  const research = useResearchStore()
  useCoachStore().conversationId = 7
  research.conversationId = 7

  const started = research.run(FORM)
  await vi.waitFor(() => expect(research.controller).not.toBeNull())
  await research.open(null)

  expect(await started).toBeNull()
})

test('a second click while running starts nothing', async () => {
  const fetch = hanging()
  vi.stubGlobal('fetch', fetch)
  const research = useResearchStore()
  useCoachStore().conversationId = 7
  research.conversationId = 7

  const started = research.run(FORM)
  expect(await research.run(FORM)).toBeNull()
  await vi.waitFor(() => expect(research.controller).not.toBeNull())
  research.controller!.abort()
  await started

  expect(fetch).toHaveBeenCalledOnce()
})

test('confirming replaces the research', async () => {
  const confirmed = { ...RESEARCH, confirmed_at: '2026-11-06T11:00:00.000Z' }
  const fetch = vi.fn().mockResolvedValue(json(confirmed))
  vi.stubGlobal('fetch', fetch)
  const research = useResearchStore()
  research.items = [RESEARCH]

  await research.confirm(RESEARCH)

  expect(fetch.mock.calls[0]![0]).toBe('/api/v1/research/3/confirm')
  expect(research.items).toEqual([confirmed])
})

test('the card shows the answer as plain text with its line breaks and nothing that loads', () => {
  const wrapper = mount(ResearchCard, {
    props: {
      research: {
        ...RESEARCH,
        text: '<img src="https://boese.de/x.png"> Siehe https://boese.de/ und [Link](https://boese.de/)',
      },
    },
  })

  expect(wrapper.find('img').exists()).toBe(false)
  const links = wrapper.findAll('a')
  expect(links.map((link) => link.attributes('href'))).toEqual(['https://kreditwerk.de/'])
  expect(links[0]!.attributes('rel')).toBe('noopener noreferrer')
  expect(wrapper.find('p.whitespace-pre-line').text()).toContain('<img src=')
})

test('the card offers the release only with sources and shows the flagged text', () => {
  const flagged = mount(ResearchCard, {
    props: {
      research: {
        ...RESEARCH,
        suspicious_text: 'Die Seite spricht eine KI an.',
        suspicious_sources: [{ url: 'https://boese.de/', title: 'Böse' }],
      },
    },
  })
  const bare = mount(ResearchCard, { props: { research: { ...RESEARCH, sources: [] } } })

  expect(flagged.text()).toContain('Die Seite spricht eine KI an.')
  expect(flagged.text()).toContain('Böse · https://boese.de/')
  expect(flagged.findAll('a')).toHaveLength(1)
  expect(flagged.text()).toContain('Für den Coach freigeben')
  expect(bare.text()).toContain('Ohne Quelle: Diese Antwort ist nicht belegt.')
  expect(bare.text()).not.toContain('Für den Coach freigeben')
})

test('the card shows a release that is done and a failed one', async () => {
  const done = mount(ResearchCard, { props: { research: { ...RESEARCH, confirmed_at: '2026-11-06T11:00:00.000Z' } } })
  expect(done.text()).toContain('Für den Coach freigegeben')
  expect(done.text()).not.toContain('Für den Coach freigeben')

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'no_sources' }, 409)))
  const open = mount(ResearchCard, { props: { research: RESEARCH } })
  await open.find('section button').trigger('click')
  await vi.waitFor(() => expect(open.text()).toContain('Ohne Quelle lässt sich diese Antwort nicht freigeben.'))
})

test('the coach window orders researches and messages by time, before and after a reload', async () => {
  Element.prototype.scrollTo = vi.fn()
  const message = (id: number, text: string, created_at: string) => ({
    id,
    role: id % 2 ? 'user' : 'assistant',
    text,
    steps: [],
    sources: [],
    stop_reason: null,
    created_at,
  })
  const before = message(1, 'Frage eins', '2026-11-06T09:00:00.000Z')
  const after = message(2, 'Antwort danach', '2026-11-06T11:00:00.000Z')
  const later = { ...RESEARCH, id: 5, company: 'Nordwerk', created_at: '2026-11-06T12:00:00.000Z' }
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
    if (init.method === 'POST') {
      return Promise.resolve(
        sse(['done', { message: message(4, 'Neue Antwort', new Date().toISOString()), stop_reason: 'end_turn' }]),
      )
    }
    if (url.includes('/research/')) return Promise.resolve(json([RESEARCH, later]))
    if (url.endsWith('/coach/conversations/7')) {
      return Promise.resolve(json({ id: 7, title: 'Bewerbung', messages: [before, after] }))
    }
    return Promise.resolve(json([]))
  })
  vi.stubGlobal('fetch', fetch)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/coach/:id?', component: CoachView }],
  })
  await router.push('/coach/7')
  const wrapper = mount(CoachView, { global: { plugins: [router] } })
  const coach = useCoachStore()
  await vi.waitFor(() => expect(wrapper.text()).toContain('Recherche zu Kreditwerk'))

  const order = (...texts: string[]) => texts.map((text) => wrapper.text().indexOf(text))
  const sorted = (positions: number[]) => {
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  }
  sorted(order('Frage eins', 'Recherche zu Kreditwerk', 'Antwort danach', 'Recherche zu Nordwerk'))

  await coach.send('Neue Frage')
  await vi.waitFor(() => expect(wrapper.text()).toContain('Neue Antwort'))

  sorted(order('Antwort danach', 'Recherche zu Nordwerk', 'Neue Frage', 'Neue Antwort'))
  wrapper.unmount()
})

test('the form sends trimmed fields and stops while running', async () => {
  const wrapper = mount(ResearchForm, { props: { running: false, note: null } })
  const [company, question] = wrapper.findAll('input')
  expect(company!.attributes('maxlength')).toBe('300')

  await wrapper.find('form').trigger('submit')
  await company!.setValue('  Kreditwerk ')
  await question!.setValue(' Wie groß? ')
  await wrapper.find('form').trigger('submit')

  expect(wrapper.emitted('submit')).toEqual([[FORM]])

  await wrapper.setProps({ running: true, note: 'Angehalten' })
  expect(wrapper.text()).toContain('Angehalten')
  await wrapper.find('button[type="button"]:not([aria-label])').trigger('click')
  expect(wrapper.emitted('stop')).toHaveLength(1)
})
