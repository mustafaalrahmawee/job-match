import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { ApiError, fetchApi, isAbort } from '../api'
import { readEvents } from '../sse'
import type { CoachStep, Research, ResearchDone, ResearchInput, ResearchOutcome } from '../types'
import { useCoachStore } from './coach'

const BASE = '/research'
const TITLE_LENGTH = 60

export const useResearchStore = defineStore('research', () => {
  const conversationId = ref<number | null>(null)
  const items = ref<Research[]>([])
  const steps = ref<CoachStep[]>([])
  const running = ref(false)
  const controller = shallowRef<AbortController | null>(null)

  async function open(id: number | null) {
    if (conversationId.value === id) return
    controller.value?.abort()
    conversationId.value = id
    items.value = []
    if (id === null) return
    const response = await fetchApi(`${BASE}/conversations/${id}`)
    const list = (await response.json()) as Research[]
    if (conversationId.value !== id) return
    const known = new Set(items.value.map((item) => item.id))
    items.value = [...list.filter((item) => !known.has(item.id)), ...items.value]
  }

  async function run(input: ResearchInput): Promise<ResearchOutcome | null> {
    if (running.value) return null
    running.value = true
    const coach = useCoachStore()
    let outcome: ResearchOutcome | null = null
    try {
      const title = `Recherche: ${input.company}`.replace(/\s+/g, ' ').trim().slice(0, TITLE_LENGTH)
      const id = coach.conversationId ?? (await coach.create(title))
      await open(id)
      if (conversationId.value !== id) return null
      const abort = new AbortController()
      controller.value = abort
      try {
        const response = await fetchApi(`${BASE}/conversations/${id}`, { method: 'POST', body: input, signal: abort.signal })
        await readEvents(response.body!, (event, data) => {
          if (event === 'step') steps.value.push(data as CoachStep)
          if (event === 'error') throw new ApiError(500)
          if (event === 'done') {
            const done = data as ResearchDone
            outcome = done.outcome
            if (done.research) items.value.push(done.research)
          }
        })
      } catch (error) {
        if (!isAbort(error)) throw error
        return conversationId.value === id ? 'stopped' : null
      }
      if (!outcome) throw new ApiError(500)
      return outcome
    } finally {
      controller.value = null
      running.value = false
      steps.value = []
    }
  }

  async function confirm(research: Research) {
    const response = await fetchApi(`${BASE}/${research.id}/confirm`, { method: 'POST' })
    const confirmed = (await response.json()) as Research
    items.value = items.value.map((item) => (item.id === confirmed.id ? confirmed : item))
  }

  return { conversationId, items, steps, running, controller, open, run, confirm }
})
