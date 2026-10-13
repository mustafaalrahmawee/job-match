<template>
  <PageHeader title="Coach">
    <button
      type="button"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      @click="newConversation"
    >
      <SquarePen class="size-4" />
      <span class="hidden sm:inline">Neues Gespräch</span>
    </button>
  </PageHeader>

  <div ref="scroller" class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div
        v-if="!coach.messages.length && !error"
        class="mt-16 flex flex-col items-center gap-3 text-center"
      >
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Sparkles class="size-5" />
        </div>
        <h2 class="text-lg font-semibold tracking-tight">Was steht bei deiner Bewerbung an?</h2>
        <p class="max-w-md text-sm text-muted-foreground">
          Frag den Coach zu Anschreiben, Lebenslauf, Vorstellungsgespräch oder Gehaltsverhandlung.
        </p>
      </div>

      <template v-for="message in coach.messages" :key="message.key">
        <div v-if="message.role === 'user'" class="flex justify-end">
          <p
            class="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm whitespace-pre-wrap text-secondary-foreground"
          >
            {{ message.text }}
          </p>
        </div>
        <div v-else class="flex gap-3">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
          >
            <Sparkles class="size-3.5" />
          </div>
          <div class="min-w-0 flex-1 pt-0.5 text-sm">
            <MarkdownText v-if="message.text" :text="message.text" />
            <span v-else class="inline-flex gap-1 py-2" aria-label="Coach schreibt">
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
            <p v-if="message.stopReason && NOTES[message.stopReason]" class="mt-1 text-xs text-muted-foreground">
              {{ NOTES[message.stopReason] }}
            </p>
          </div>
        </div>
      </template>

      <div
        v-if="error || coach.canRetry"
        class="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
        :class="error ? 'border-destructive/30 bg-destructive/5' : ''"
        role="alert"
      >
        <span class="flex-1">{{ error ?? 'Auf diese Nachricht gibt es noch keine Antwort.' }}</span>
        <button
          v-if="coach.canRetry"
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 font-medium hover:bg-accent"
          @click="talk(coach.retry)"
        >
          <RotateCcw class="size-3.5" />
          Erneut versuchen
        </button>
      </div>
    </div>
  </div>

  <form class="shrink-0 px-4 pb-4" @submit.prevent="submit">
    <div
      class="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40"
    >
      <textarea
        ref="input"
        v-model="draft"
        rows="1"
        maxlength="10000"
        placeholder="Nachricht an den Coach"
        aria-label="Nachricht an den Coach"
        class="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
        @input="resize"
        @keydown="onKeydown"
      />
      <button
        v-if="coach.streaming"
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        aria-label="Antwort anhalten"
        title="Antwort anhalten"
        @click="coach.controller?.abort()"
      >
        <Square class="size-3.5 fill-current" />
      </button>
      <button
        v-else
        type="submit"
        :disabled="!draft.trim()"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        aria-label="Senden"
        title="Senden"
      >
        <ArrowUp class="size-4" />
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ArrowUp, RotateCcw, Sparkles, Square, SquarePen } from '@lucide/vue'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, isAbort } from '../api'
import MarkdownText from '../components/MarkdownText.vue'
import PageHeader from '../components/PageHeader.vue'
import { useCoachStore } from '../stores/coach'

const coach = useCoachStore()
const route = useRoute()
const router = useRouter()
const draft = ref('')
const error = ref<string | null>(null)
const scroller = useTemplateRef('scroller')
const input = useTemplateRef('input')

const NOTES: Record<string, string> = {
  stopped: 'Angehalten',
  max_tokens: 'Die Antwort wurde gekürzt.',
  model_context_window_exceeded: 'Die Antwort wurde gekürzt, weil das Gespräch zu lang ist.',
}

watch(
  () => route.params.id,
  async (id) => {
    error.value = null
    if (typeof id === 'string') return open(Number(id))
    const last = coach.lastId()
    if (last !== null) await router.replace(`/coach/${last}`)
    else coach.startNew()
  },
  { immediate: true },
)

watch(
  () => coach.conversationId,
  async (id) => {
    if (id !== null && route.params.id !== String(id)) await router.replace(`/coach/${id}`)
  },
)

watch(
  () => [coach.messages.length, coach.messages.at(-1)?.text],
  async () => {
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
  },
)

async function open(id: number) {
  try {
    await coach.load(id)
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 404 ? 'Gespräch nicht gefunden.' : 'Gespräch konnte nicht geladen werden.'
  }
}

async function talk(action: () => Promise<string | null>) {
  error.value = null
  try {
    const stopReason = await action()
    if (stopReason === 'refusal') error.value = 'Der Coach kann auf diese Nachricht nicht antworten.'
  } catch (e) {
    if (isAbort(e)) return
    if (!(e instanceof ApiError)) error.value = 'Die Verbindung zum Coach ist abgebrochen.'
    else if (e.status === 401) error.value = 'Bitte melde dich neu an.'
    else error.value = 'Der Coach konnte nicht antworten.'
  }
}

async function submit() {
  const text = draft.value.trim()
  if (!text || coach.streaming) return
  draft.value = ''
  resize()
  await talk(() => coach.send(text))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void submit()
  }
}

function resize() {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

async function newConversation() {
  coach.startNew()
  error.value = null
  await router.push('/coach')
  input.value?.focus()
}
</script>
