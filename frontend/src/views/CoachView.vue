<template>
  <PageHeader :title="title">
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
        <div v-if="message.role === 'user'" class="group flex flex-col items-end gap-1">
          <p
            class="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm whitespace-pre-wrap text-secondary-foreground"
          >
            {{ message.text }}
          </p>
          <CopyButton
            :text="message.text"
            class="md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          />
        </div>
        <div v-else class="flex gap-3">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
          >
            <Sparkles class="size-3.5" />
          </div>
          <div class="min-w-0 flex-1 pt-0.5 text-sm">
            <ul v-if="message.steps.length" class="mb-3 flex flex-col gap-1.5">
              <li
                v-for="(step, index) in message.steps"
                :key="index"
                class="flex items-center gap-2 rounded-md border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                <CircleAlert
                  v-if="step.kind === 'application_failed' || (step.kind === 'web_search' && step.sources === null)"
                  class="size-3.5 shrink-0"
                />
                <Check v-else class="size-3.5 shrink-0 text-success" />
                <span v-if="step.kind === 'application'" class="min-w-0 truncate">
                  Bewerbung gelesen: {{ step.title }}{{ step.company ? ` · ${step.company}` : '' }}
                </span>
                <span v-else-if="step.kind === 'application_failed'">Bewerbung konnte nicht gelesen werden</span>
                <span v-else class="min-w-0 truncate">
                  Websuche: „{{ step.query }}“ ·
                  {{
                    step.sources === null
                      ? 'fehlgeschlagen'
                      : `${step.sources} ${step.sources === 1 ? 'Quelle' : 'Quellen'} gelesen`
                  }}
                </span>
              </li>
            </ul>
            <MarkdownText v-if="message.text" :text="message.text" />
            <span
              v-else-if="coach.streaming && message === coach.messages.at(-1)"
              class="inline-flex gap-1 py-2"
              aria-label="Coach schreibt"
            >
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
            <div v-if="message.sources.length" class="mt-3 text-xs text-muted-foreground">
              <p class="font-medium">Quellen</p>
              <ol class="mt-1 flex flex-col gap-0.5">
                <li v-for="source in message.sources" :key="source.url" class="truncate">
                  <a :href="source.url" target="_blank" rel="noopener noreferrer" class="text-brand underline">
                    {{ source.title || source.url }}
                  </a>
                </li>
              </ol>
            </div>
            <p v-if="message.stopReason && NOTES[message.stopReason]" class="mt-1 text-xs text-muted-foreground">
              {{ NOTES[message.stopReason] }}
            </p>
            <CopyButton
              v-if="message.text && !(coach.streaming && message === coach.messages.at(-1))"
              :text="message.text"
              class="mt-1 -ml-1.5"
            />
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

  <div class="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
    <ChatInput
      ref="input"
      v-model:quality="coach.quality"
      v-model:effort="coach.effort"
      :streaming="coach.streaming"
      @send="(text) => talk(() => coach.send(text))"
      @stop="coach.controller?.abort()"
    />
  </div>
</template>

<script setup lang="ts">
import { Check, CircleAlert, RotateCcw, Sparkles, SquarePen } from '@lucide/vue'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, isAbort } from '../api'
import ChatInput from '../components/ChatInput.vue'
import CopyButton from '../components/CopyButton.vue'
import MarkdownText from '../components/MarkdownText.vue'
import PageHeader from '../components/PageHeader.vue'
import { useCoachStore } from '../stores/coach'

const coach = useCoachStore()
const route = useRoute()
const router = useRouter()
const error = ref<string | null>(null)
const scroller = useTemplateRef('scroller')
const input = useTemplateRef('input')
const title = computed(() => coach.conversations.find((c) => c.id === coach.conversationId)?.title ?? 'Coach')

const NOTES: Record<string, string> = {
  stopped: 'Angehalten',
  max_tokens: 'Die Antwort wurde gekürzt.',
  model_context_window_exceeded: 'Die Antwort wurde gekürzt, weil das Gespräch zu lang ist.',
  pause_turn: 'Die Websuche ist nicht fertig geworden. Stell deine Frage noch einmal.',
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
  () => [coach.messages.length, coach.messages.at(-1)?.text, coach.messages.at(-1)?.steps.length],
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

async function newConversation() {
  coach.startNew()
  error.value = null
  await router.push('/coach')
  input.value?.focus()
}
</script>
