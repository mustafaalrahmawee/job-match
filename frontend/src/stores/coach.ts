import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { ApiError, fetchApi } from '../api'
import { readEvents } from '../sse'
import type { ChatMessage, Conversation, Delta, Done, Role } from '../types'

const BASE = '/coach/conversations'
const LAST_KEY = 'coach_conversation'
const TITLE_LENGTH = 60

let nextKey = 0

function chatMessage(role: Role, text: string, stopReason: string | null = null): ChatMessage {
  nextKey += 1
  return { key: `m${nextKey}`, role, text, stopReason }
}

export const useCoachStore = defineStore('coach', () => {
  const conversationId = ref<number | null>(null)
  const messages = ref<ChatMessage[]>([])
  const streaming = ref(false)
  const controller = shallowRef<AbortController | null>(null)

  watch(conversationId, (id) => {
    if (id !== null) localStorage.setItem(LAST_KEY, String(id))
  })

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
    return body.id
  }

  async function send(text: string): Promise<string | null> {
    if (streaming.value) return null
    const title = text.replace(/\s+/g, ' ').trim().slice(0, TITLE_LENGTH)
    const id = conversationId.value ?? (await create(title))
    messages.value.push(chatMessage('user', text))
    return stream(`${BASE}/${id}/messages`, { content: text })
  }

  async function retry(): Promise<string | null> {
    if (!canRetry.value || conversationId.value === null) return null
    return stream(`${BASE}/${conversationId.value}/retry`)
  }

  async function stream(path: string, body?: unknown): Promise<string | null> {
    streaming.value = true
    const abort = new AbortController()
    controller.value = abort
    messages.value.push(chatMessage('assistant', ''))
    const answer = messages.value.at(-1)!
    try {
      const response = await fetchApi(path, { method: 'POST', body, signal: abort.signal })
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
    conversationId,
    messages,
    streaming,
    controller,
    canRetry,
    lastId,
    startNew,
    load,
    send,
    retry,
  }
})
