<template>
  <PageHeader title="Training" />

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto grid max-w-6xl items-start gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div class="flex min-w-0 flex-col gap-4">
        <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
          {{ error }}
        </p>

        <section class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
          <h2 class="text-sm font-semibold">Neues Training</h2>
          <template v-if="matches.list.length">
            <div class="flex flex-col gap-2">
              <label for="training-job" class="text-sm font-medium">Stelle</label>
              <select
                id="training-job"
                v-model="jobId"
                class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option v-for="match in matches.list" :key="match.job.id" :value="match.job.id">
                  {{ [match.job.title, match.job.company].filter(Boolean).join(' · ') }} ({{ match.score }})
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-2">
              <label for="training-difficulty" class="text-sm font-medium">Schwierigkeit</label>
              <select
                id="training-difficulty"
                v-model="difficulty"
                class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option v-for="level in INTERVIEW_DIFFICULTIES" :key="level" :value="level">
                  {{ INTERVIEW_DIFFICULTY_LABELS[level] }}
                </option>
              </select>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p class="flex-1 text-xs text-muted-foreground">
                Fragen aus Anzeige, Lebenslauf und Match. Du kannst jederzeit pausieren und später fortsetzen; am Ende
                gibt es einen Bericht.
              </p>
              <button
                type="button"
                class="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                :disabled="starting || jobId === null"
                @click="start"
              >
                <LoaderCircle v-if="starting" class="size-4 animate-spin" />
                {{ starting ? 'Erste Frage wird erstellt …' : 'Training starten' }}
              </button>
            </div>
          </template>
          <div v-else-if="loaded" class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p class="flex-1 text-sm text-muted-foreground">
              Für das Training braucht es zuerst eine Match-Analyse einer Stelle.
            </p>
            <RouterLink
              to="/matches"
              class="flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
            >
              Zu den Matches
            </RouterLink>
          </div>
        </section>
      </div>

      <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
        <h2 class="text-sm font-semibold">Alle Trainings</h2>
        <ul v-if="interviews.list.length" class="-mx-2 flex flex-col">
          <li v-for="session in interviews.list" :key="session.id">
            <RouterLink
              :to="`/trainings/${session.id}`"
              class="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate">{{ day(session.created_at) }} · {{ session.job.company ?? session.job.title }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ INTERVIEW_DIFFICULTY_LABELS[session.difficulty] }} ·
                  {{
                    session.status === 'finished'
                      ? `${session.question_count} Fragen`
                      : `pausiert bei ${session.turns.length} von ${session.question_count}`
                  }}
                </p>
              </div>
              <span v-if="session.report" class="font-medium">{{ session.report.score }}</span>
              <span
                v-else-if="session.status === 'running'"
                class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                Pausiert
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-else-if="loaded" class="text-sm text-muted-foreground">Noch kein Training.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useInterviewsStore } from '../stores/interviews'
import { useMatchesStore } from '../stores/matches'
import { INTERVIEW_DIFFICULTIES, INTERVIEW_DIFFICULTY_LABELS, type InterviewDifficulty } from '../types'

const START_ERRORS: Record<string, string> = {
  no_match: 'Für das Training braucht es zuerst eine Match-Analyse dieser Stelle.',
  limit_reached: 'Du hast heute schon drei Trainings gestartet. Morgen geht es weiter.',
  unavailable: 'Dienst gerade nicht erreichbar.',
  timeout: 'Die erste Frage hat zu lange gedauert.',
}

const interviews = useInterviewsStore()
const matches = useMatchesStore()
const route = useRoute()
const router = useRouter()
const error = ref<string | null>(null)
const loaded = ref(false)
const starting = ref(false)
const jobId = ref<number | null>(null)
const difficulty = ref<InterviewDifficulty>(
  INTERVIEW_DIFFICULTIES.find((level) => level === route.query.difficulty) ?? 'medium',
)

function day(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

async function start() {
  if (jobId.value === null) return
  starting.value = true
  error.value = null
  try {
    const session = await interviews.start(jobId.value, difficulty.value)
    await router.push(`/trainings/${session.id}`)
  } catch (caught) {
    const code = caught instanceof ApiError && typeof caught.detail === 'string' ? caught.detail : ''
    error.value =
      caught instanceof ApiError && caught.status === 404
        ? 'Diese Stelle gibt es nicht.'
        : (START_ERRORS[code] ?? 'Das Training konnte nicht starten.')
  } finally {
    starting.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([interviews.loadList(), matches.loadList()])
    const wanted = Number(route.query.job)
    jobId.value = matches.list.find((match) => match.job.id === wanted)?.job.id ?? matches.list[0]?.job.id ?? null
  } catch {
    error.value = 'Die Trainings konnten nicht geladen werden.'
  } finally {
    loaded.value = true
  }
})
</script>
