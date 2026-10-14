import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { ApiError, fetchApi } from '../api'
import { readEvents } from '../sse'
import type { ChatMessage, Conversation, ConversationSummary, Delta, Done, Effort, Quality, Role } from '../types'

const BASE = '/coach/conversations'
const LAST_KEY = 'coach_conversation'
const QUALITY_KEY = 'coach_quality'
const EFFORT_KEY = 'coach_effort'
const TITLE_LENGTH = 60

let nextKey = 0

function chatMessage(role: Role, text: string, stopReason: string | null = null): ChatMessage {
  nextKey += 1
  return { key: `m${nextKey}`, role, text, stopReason }
}

export const useCoachStore = defineStore('coach', () => {
  const conversations = ref<ConversationSummary[]>([])
  const conversationId = ref<number | null>(null)
  const messages = ref<ChatMessage[]>([])
  const quality = ref<Quality>(localStorage.getItem(QUALITY_KEY) === 'normal' ? 'normal' : 'extended')
  const effort = ref<Effort>(localStorage.getItem(EFFORT_KEY) === 'high' ? 'high' : 'medium')
  const streaming = ref(false)
  const controller = shallowRef<AbortController | null>(null)

  watch(conversationId, (id) => {
    if (id !== null) localStorage.setItem(LAST_KEY, String(id))
  })
  watch(quality, (value) => localStorage.setItem(QUALITY_KEY, value))
  watch(effort, (value) => localStorage.setItem(EFFORT_KEY, value))

  const canRetry = computed(() => !streaming.value && messages.value.at(-1)?.role === 'user')

  function lastId(): number | null {
    if (conversationId.value !== null) return conversationId.value
    const stored = Number(localStorage.getItem(LAST_KEY))
    return stored > 0 ? stored : null
  }

  function startNew() {
    controller.value?.abort()
    conversationId.value = null
    messages.value = []
    localStorage.removeItem(LAST_KEY)
  }

  async function loadList() {
    const response = await fetchApi(BASE)
    conversations.value = (await response.json()) as ConversationSummary[]
  }

  async function rename(id: number, title: string) {
    const response = await fetchApi(`${BASE}/${id}`, { method: 'PATCH', body: { title } })
    const renamed = (await response.json()) as ConversationSummary
    conversations.value = conversations.value.map((c) => (c.id === id ? renamed : c))
  }

  async function remove(id: number) {
    await fetchApi(`${BASE}/${id}`, { method: 'DELETE' })
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (lastId() === id) startNew()
  }

  async function load(id: number) {
    if (conversationId.value === id) return
    startNew()
    const response = await fetchApi(`${BASE}/${id}`)
    const body = (await response.json()) as Conversation
    conversationId.value = body.id
    messages.value = body.messages.map((m) => chatMessage(m.role, m.text, m.stop_reason))
  }

  async function create(title: string): Promise<number> {
    const response = await fetchApi(BASE, { method: 'POST', body: { title } })
    const body = (await response.json()) as Conversation
    conversationId.value = body.id
    conversations.value.unshift({ id: body.id, title: body.title })
    return body.id
  }

  async function send(text: string): Promise<string | null> {
    if (streaming.value) return null
    const title = text.replace(/\s+/g, ' ').trim().slice(0, TITLE_LENGTH)
    const id = conversationId.value ?? (await create(title))
    const current = conversations.value.find((c) => c.id === id)
    if (current) conversations.value = [current, ...conversations.value.filter((c) => c !== current)]
    messages.value.push(chatMessage('user', text))
    return stream(`${BASE}/${id}/messages`, { content: text })
  }

  async function retry(): Promise<string | null> {
    if (!canRetry.value || conversationId.value === null) return null
    return stream(`${BASE}/${conversationId.value}/retry`)
  }

  async function stream(path: string, body: object = {}): Promise<string | null> {
    streaming.value = true
    const abort = new AbortController()
    controller.value = abort
    messages.value.push(chatMessage('assistant', ''))
    const answer = messages.value.at(-1)!
    try {
      const response = await fetchApi(path, {
        method: 'POST',
        body: { ...body, quality: quality.value, effort: effort.value },
        signal: abort.signal,
      })
      await readEvents(response.body!, (event, data) => {
        if (event === 'delta') answer.text += (data as Delta).text
        if (event === 'error') throw new ApiError(500)
        if (event === 'done') {
          const done = data as Done
          answer.stopReason = done.stop_reason
          if (done.message) answer.text = done.message.text
          else messages.value = messages.value.filter((m) => m !== answer)
        }
      })
      return answer.stopReason
    } catch (error) {
      if (abort.signal.aborted && answer.text) answer.stopReason = 'stopped'
      else messages.value = messages.value.filter((m) => m !== answer)
      throw error
    } finally {
      if (controller.value === abort) controller.value = null
      streaming.value = false
    }
  }

  return {
    conversations,
    conversationId,
    messages,
    quality,
    effort,
    streaming,
    controller,
    canRetry,
    lastId,
    startNew,
    loadList,
    rename,
    remove,
    load,
    send,
    retry,
  }
})
