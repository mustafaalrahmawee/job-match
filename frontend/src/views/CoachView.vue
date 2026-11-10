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
        v-if="!timeline.length && !research.running && !error"
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

      <template v-for="entry in timeline" :key="entry.key">
        <ResearchCard v-if="entry.research" :research="entry.research" />
        <div v-else-if="entry.message.role === 'user'" class="group flex flex-col items-end gap-1">
          <p
            class="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 text-sm whitespace-pre-wrap text-secondary-foreground"
          >
            {{ entry.message.text }}
          </p>
          <CopyButton
            :text="entry.message.text"
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
            <StepList :steps="entry.message.steps" class="mb-3" />
            <MarkdownText v-if="entry.message.text" :text="entry.message.text" />
            <span
              v-else-if="coach.streaming && entry.message === coach.messages.at(-1)"
              class="inline-flex gap-1 py-2"
              aria-label="Coach schreibt"
            >
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
            <p v-if="entry.message.stopReason && NOTES[entry.message.stopReason]" class="mt-1 text-xs text-muted-foreground">
              {{ NOTES[entry.message.stopReason] }}
            </p>
            <CopyButton
              v-if="entry.message.text && !(coach.streaming && entry.message === coach.messages.at(-1))"
              :text="entry.message.text"
              class="mt-1 -ml-1.5"
            />
          </div>
        </div>
      </template>

      <div v-if="research.running" class="flex gap-3">
        <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Search class="size-3.5" />
        </div>
        <div class="min-w-0 flex-1 pt-0.5 text-sm">
          <StepList :steps="research.steps" class="mb-1" />
          <span class="inline-flex gap-1 py-2" aria-label="Recherche läuft">
            <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
            <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span class="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        </div>
      </div>

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

  <div class="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-2 px-4 pb-4">
    <ResearchForm
      v-if="researchOpen"
      :running="research.running"
      :note="researchNote"
      @submit="startResearch"
      @stop="research.controller?.abort()"
      @close="closeResearch"
    />
    <button
      v-else
      type="button"
      class="flex h-8 items-center gap-1.5 self-start rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      @click="researchOpen = true"
    >
      <Search class="size-4" />
      Firma recherchieren
    </button>
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
import { RotateCcw, Search, Sparkles, SquarePen } from '@lucide/vue'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, isAbort } from '../api'
import ChatInput from '../components/ChatInput.vue'
import CopyButton from '../components/CopyButton.vue'
import MarkdownText from '../components/MarkdownText.vue'
import PageHeader from '../components/PageHeader.vue'
import ResearchCard from '../components/ResearchCard.vue'
import ResearchForm from '../components/ResearchForm.vue'
import StepList from '../components/StepList.vue'
import { useCoachStore } from '../stores/coach'
import { useResearchStore } from '../stores/research'
import type { ChatMessage, Research, ResearchInput, ResearchOutcome } from '../types'

const coach = useCoachStore()
const research = useResearchStore()
const route = useRoute()
const router = useRouter()
const error = ref<string | null>(null)
const scroller = useTemplateRef('scroller')
const input = useTemplateRef('input')
const researchOpen = ref(false)
const researchNote = ref<string | null>(null)
const title = computed(() => coach.conversations.find((c) => c.id === coach.conversationId)?.title ?? 'Coach')

type TimelineEntry = { key: string; research: Research; message?: never } | { key: string; message: ChatMessage; research?: never }

const timeline = computed(() => {
  const entries: TimelineEntry[] = []
  const waiting = [...research.items]
  const place = (item: Research) => entries.push({ key: `r${item.id}`, research: item })
  for (const message of coach.messages) {
    while (waiting[0] && waiting[0].created_at < message.createdAt) place(waiting.shift()!)
    entries.push({ key: message.key, message })
  }
  waiting.forEach(place)
  return entries
})

const NOTES: Record<string, string> = {
  stopped: 'Angehalten',
  max_tokens: 'Die Antwort wurde gekürzt.',
  model_context_window_exceeded: 'Die Antwort wurde gekürzt, weil das Gespräch zu lang ist.',
  pause_turn: 'Die Websuche ist nicht fertig geworden. Stell deine Frage noch einmal.',
}

const RESEARCH_NOTES: Record<Exclude<ResearchOutcome, 'ready'>, string> = {
  empty: 'Die Recherche hat keine Antwort ergeben. Stell deine Frage noch einmal.',
  unfinished: 'Die Recherche ist nicht fertig geworden. Stell deine Frage noch einmal.',
  stopped: 'Angehalten',
  refused: 'Die Recherche kann auf diese Anfrage nicht antworten.',
}

const RESEARCH_ERRORS: Record<number, string> = {
  401: 'Bitte melde dich neu an.',
  404: 'Gespräch nicht gefunden.',
  422: 'Bitte gib Firma und Frage an, je bis zu 300 Zeichen.',
  429: 'Du hast heute schon fünf Recherchen gestartet. Morgen geht es weiter.',
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
  () => coach.conversationId,
  async (id) => {
    researchNote.value = null
    try {
      await research.open(id)
    } catch {
      researchNote.value = 'Die Recherchen konnten nicht geladen werden.'
    }
  },
  { immediate: true },
)

watch(
  () => [
    coach.messages.length,
    coach.messages.at(-1)?.text,
    coach.messages.at(-1)?.steps.length,
    research.items.length,
    research.steps.length,
    research.running,
  ],
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
    else if (e.status === 429) error.value = 'Du hast heute schon 50 Antworten vom Coach bekommen. Morgen geht es weiter.'
    else error.value = 'Der Coach konnte nicht antworten.'
  }
}

async function startResearch(form: ResearchInput) {
  researchNote.value = null
  try {
    const outcome = await research.run(form)
    if (outcome === 'ready') researchOpen.value = false
    else if (outcome) researchNote.value = RESEARCH_NOTES[outcome]
  } catch (e) {
    researchNote.value = (e instanceof ApiError && RESEARCH_ERRORS[e.status]) || 'Die Recherche ist fehlgeschlagen.'
  }
}

function closeResearch() {
  researchOpen.value = false
  researchNote.value = null
}

async function newConversation() {
  coach.startNew()
  error.value = null
  await router.push('/coach')
  input.value?.focus()
}
</script>
