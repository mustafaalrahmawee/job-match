<template>
  <PageHeader :title="title">
    <RouterLink
      v-if="session?.status === 'running'"
      to="/trainings"
      class="flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
    >
      <Pause class="size-3.5" />
      Pausieren
    </RouterLink>
    <RouterLink
      v-else-if="session"
      :to="`/trainings?job=${session.job.id}`"
      class="flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
    >
      <GraduationCap class="size-3.5" />
      Neues Training
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <div
        v-if="stepError"
        class="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center"
        role="alert"
      >
        <span class="flex-1">{{ stepError.text }}</span>
        <RouterLink
          v-if="stepError.code === 'no_match' && session"
          :to="`/matches/${session.job.id}`"
          class="flex h-8 items-center justify-center rounded-md border bg-background px-3 font-medium hover:bg-accent"
        >
          Zur Match-Analyse
        </RouterLink>
        <button
          v-else-if="session?.pending"
          type="button"
          class="flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 font-medium hover:bg-accent disabled:opacity-50"
          :disabled="busy"
          @click="act('continue')"
        >
          <RotateCcw class="size-3.5" />
          Erneut versuchen
        </button>
      </div>

      <section
        v-if="session?.pending && !stepError"
        class="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center"
      >
        <span class="flex-1">
          {{ session.status === 'finished' ? 'Der Bericht fehlt noch.' : 'Der nächste Schritt fehlt noch.' }}
        </span>
        <button
          type="button"
          class="flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 font-medium hover:bg-accent disabled:opacity-50"
          :disabled="busy"
          @click="act('continue')"
        >
          <LoaderCircle v-if="busy" class="size-3.5 animate-spin text-brand" />
          <RotateCcw v-else class="size-3.5" />
          Fortsetzen
        </button>
      </section>

      <div
        v-if="session && session.status === 'running'"
        class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div class="flex min-w-0 flex-col gap-4">
          <section v-if="open" class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="font-medium text-foreground">Frage {{ open.number }} von {{ session.question_count }}</span>
              <span>Schwierigkeit: {{ INTERVIEW_DIFFICULTY_LABELS[session.difficulty] }}</span>
            </div>
            <p class="text-sm">{{ open.question }}</p>
            <p v-if="reference" class="border-l-3 pl-3 text-xs text-muted-foreground">{{ reference }}</p>
            <div class="flex flex-col gap-2">
              <label for="training-answer" class="text-sm font-medium">Deine Antwort</label>
              <textarea
                id="training-answer"
                v-model="draft"
                rows="8"
                :maxlength="ANSWER_MAX_CHARS"
                :disabled="busy"
                class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
              />
            </div>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p class="flex-1 text-xs text-muted-foreground">Schriftlich, in Ruhe. Es gibt kein Zeitlimit.</p>
              <button
                type="button"
                class="flex h-9 items-center justify-center rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                :disabled="busy"
                @click="act('skip')"
              >
                Frage überspringen
              </button>
              <button
                type="button"
                class="flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                :disabled="busy || !draft.trim()"
                @click="act('answer')"
              >
                <LoaderCircle v-if="busy" class="size-4 animate-spin" />
                {{ busy ? 'Wird bewertet …' : 'Antwort abgeben' }}
              </button>
            </div>
          </section>

          <section
            v-else-if="busy"
            class="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center shadow-sm"
            role="status"
          >
            <LoaderCircle class="size-5 animate-spin text-brand" />
            <h2 class="text-sm font-semibold">Wird vorbereitet …</h2>
          </section>

          <section v-if="graded" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <div class="flex items-center gap-2">
              <h2 class="flex-1 text-sm font-semibold">Bewertung zu Frage {{ graded.number }}</h2>
              <span class="text-sm font-semibold">{{ graded.score }} / 10</span>
            </div>
            <p class="text-sm text-muted-foreground">„{{ graded.question }}“</p>
            <p class="text-sm">
              <template v-if="graded.good"><span class="font-medium">Gut:</span> {{ graded.good }} </template>
              <span class="font-medium">Besser:</span> {{ graded.better }}
            </p>
          </section>
        </div>

        <aside class="flex flex-col gap-4 lg:sticky lg:top-0">
          <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Verlauf</h2>
            <ol class="flex flex-col">
              <li v-for="turn in session.turns" :key="turn.number" class="flex items-center gap-3 py-1 text-sm">
                <span class="w-4 text-xs text-muted-foreground">{{ turn.number }}</span>
                <span class="min-w-0 flex-1 truncate">{{ turn.title }}</span>
                <span v-if="turn.score !== null" class="font-medium">{{ turn.score }}</span>
                <span v-else-if="turn.skipped" class="text-xs text-muted-foreground">übersprungen</span>
                <span v-else class="text-xs text-muted-foreground">jetzt</span>
              </li>
              <li v-if="session.turns.length < session.question_count" class="flex items-center gap-3 py-1 text-sm">
                <span class="text-xs text-muted-foreground">{{ remaining }}</span>
                <span class="text-muted-foreground">noch offen</span>
              </li>
            </ol>
          </section>
          <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Dieses Training</h2>
            <p class="text-sm text-muted-foreground">
              Fragen aus Anzeige, Lebenslauf und Match. Du kannst jederzeit pausieren und später fortsetzen; am Ende
              gibt es einen Bericht.
            </p>
          </section>
        </aside>
      </div>

      <div
        v-else-if="session && session.report"
        class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div class="flex min-w-0 flex-col gap-4">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <section class="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
              <span class="text-xs font-medium text-muted-foreground">Gesamtnote</span>
              <span class="text-2xl font-semibold">
                {{ session.report.score }}<span class="text-sm font-normal text-muted-foreground"> / 10</span>
              </span>
            </section>
            <section class="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
              <span class="text-xs font-medium text-muted-foreground">Fragen</span>
              <span class="text-2xl font-semibold">{{ session.turns.length }}</span>
              <span class="text-xs text-muted-foreground">
                Schwierigkeit {{ INTERVIEW_DIFFICULTY_LABELS[session.difficulty] }}
              </span>
            </section>
            <section
              v-for="card in areaCards"
              :key="card.label"
              class="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm"
            >
              <span class="text-xs font-medium text-muted-foreground">{{ card.label }}</span>
              <span class="truncate text-base leading-8 font-semibold">{{ card.area.area }}</span>
              <span class="text-xs text-muted-foreground">
                Ø {{ card.area.average.toLocaleString('de-DE', { minimumFractionDigits: 1 }) }}
              </span>
            </section>
          </div>

          <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Fragen und Noten</h2>
            <ol class="flex flex-col divide-y">
              <li v-for="turn in session.turns" :key="turn.number" class="flex items-start gap-3 py-2 text-sm">
                <span class="w-4 pt-px text-xs text-muted-foreground">{{ turn.number }}</span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ turn.title }}</p>
                  <p class="text-muted-foreground">{{ turn.skipped ? 'übersprungen' : turn.line }}</p>
                </div>
                <span v-if="turn.score !== null" class="font-medium">{{ turn.score }}</span>
              </li>
            </ol>
          </section>
        </div>

        <aside class="flex flex-col gap-4 lg:sticky lg:top-0">
          <section class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Empfehlung</h2>
            <ul class="flex list-disc flex-col gap-2 pl-4 text-sm">
              <li v-for="(recommendation, index) in session.report.recommendations" :key="index">
                {{ recommendation }}
              </li>
            </ul>
            <RouterLink
              :to="`/trainings?job=${session.job.id}&difficulty=${nextDifficulty}`"
              class="flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Training {{ INTERVIEW_DIFFICULTY_LABELS[nextDifficulty] }} starten
            </RouterLink>
          </section>
          <section v-if="others.length" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Alle Trainings</h2>
            <RouterLink
              v-for="other in others"
              :key="other.id"
              :to="`/trainings/${other.id}`"
              class="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span class="min-w-0 flex-1 truncate">
                {{ day(other.created_at) }} · {{ other.job.company ?? other.job.title }} ·
                {{ INTERVIEW_DIFFICULTY_LABELS[other.difficulty] }} ·
                {{
                  other.status === 'finished'
                    ? `${other.question_count} Fragen`
                    : `pausiert bei ${other.turns.length} von ${other.question_count}`
                }}
              </span>
              <span v-if="other.report" class="font-medium">{{ other.report.score }}</span>
              <span
                v-else-if="other.status === 'running'"
                class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                Pausiert
              </span>
            </RouterLink>
          </section>
        </aside>
      </div>

      <section
        v-else-if="session && !session.pending"
        class="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground shadow-sm"
      >
        Du hast alle Fragen übersprungen, deshalb gibt es zu diesem Training keinen Bericht.
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GraduationCap, LoaderCircle, Pause, RotateCcw } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useInterviewsStore } from '../stores/interviews'
import { INTERVIEW_DIFFICULTIES, INTERVIEW_DIFFICULTY_LABELS, type InterviewArea } from '../types'

const ANSWER_MAX_CHARS = 4000

const STEP_ERRORS: Record<string, string> = {
  no_match: 'Für das Training braucht es zuerst eine Match-Analyse dieser Stelle.',
  no_open_question: 'Diese Frage ist schon beantwortet.',
  busy: 'Das Training wird gerade an anderer Stelle fortgesetzt.',
  unavailable: 'Dienst gerade nicht erreichbar.',
  timeout: 'Das hat zu lange gedauert.',
}

const interviews = useInterviewsStore()
const route = useRoute()
const error = ref<string | null>(null)
const stepError = ref<{ code: string; text: string } | null>(null)
const busy = ref(false)
const draft = ref('')

const session = computed(() => interviews.current)

const title = computed(() => {
  const current = session.value
  if (!current) return 'Training'
  const place = [current.job.title, current.job.company].filter(Boolean).join(', ')
  return current.status === 'running'
    ? `Training · ${place}`
    : `Bericht · Training vom ${day(current.created_at)}, ${current.job.company ?? current.job.title}`
})

const open = computed(() => {
  const last = session.value?.turns.at(-1)
  return last && last.answer === null && !last.skipped ? last : null
})

const graded = computed(() => [...(session.value?.turns ?? [])].reverse().find((turn) => turn.score !== null) ?? null)

const reference = computed(() => {
  const turn = open.value
  if (!turn) return ''
  const score = session.value?.match_score
  const parts = [
    turn.gap && `Lücke: ${turn.gap}${score !== null && score !== undefined ? ` im Match (${score})` : ''}`,
    turn.ad_quote && `Anzeige: „${turn.ad_quote}“`,
  ].filter(Boolean)
  return parts.length ? `Bezug: ${parts.join(' · ')}` : ''
})

const remaining = computed(() => {
  const current = session.value
  if (!current) return ''
  const from = current.turns.length + 1
  return from === current.question_count ? `${from}` : `${from}–${current.question_count}`
})

const areaCards = computed(() => {
  const report = session.value?.report
  if (!report) return []
  const cards: { label: string; area: InterviewArea }[] = [{ label: 'Stärkster Bereich', area: report.strongest }]
  if (report.weakest) cards.push({ label: 'Übungsbedarf', area: report.weakest })
  return cards
})

const nextDifficulty = computed(() => {
  const index = INTERVIEW_DIFFICULTIES.indexOf(session.value?.difficulty ?? 'medium')
  return INTERVIEW_DIFFICULTIES[Math.min(index + 1, INTERVIEW_DIFFICULTIES.length - 1)]
})

const others = computed(() =>
  interviews.list.filter((other) => other.job.id === session.value?.job.id && other.id !== session.value?.id),
)

function day(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

async function act(action: 'answer' | 'skip' | 'continue') {
  const id = Number(route.params.id)
  busy.value = true
  stepError.value = null
  try {
    await interviews.step(id, action, action === 'answer' ? { answer: draft.value } : undefined)
    if (action !== 'continue') draft.value = ''
  } catch (caught) {
    const code = caught instanceof ApiError && typeof caught.detail === 'string' ? caught.detail : ''
    stepError.value = { code, text: STEP_ERRORS[code] ?? 'Das hat nicht geklappt.' }
  } finally {
    busy.value = false
  }
}

watch(
  () => route.params.id,
  async () => {
    const id = Number(route.params.id)
    error.value = null
    stepError.value = null
    draft.value = ''
    try {
      await Promise.all([interviews.load(id), interviews.loadList()])
    } catch (caught) {
      error.value =
        caught instanceof ApiError && caught.status === 404
          ? 'Dieses Training gibt es nicht.'
          : 'Das Training konnte nicht geladen werden.'
    }
  },
  { immediate: true },
)
</script>
