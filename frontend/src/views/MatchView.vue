<template>
  <PageHeader :title="jobs.job ? `Match · ${jobs.job.title}` : 'Match'">
    <RouterLink
      to="/matches"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      <span class="hidden sm:inline">Matches</span>
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <template v-if="jobs.job">
        <section class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <MatchScore :score="matches.current?.score ?? null">
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold tracking-tight">{{ jobs.job.title }}</h2>
              <p class="mt-0.5 text-sm text-muted-foreground">
                {{ [jobs.job.company, jobs.job.city].filter(Boolean).join(' · ') }}
              </p>
              <RouterLink
                :to="jobs.job.source === 'own' ? `/jobs/own/${jobs.job.id}` : `/jobs/${jobs.job.id}`"
                class="mt-3 inline-flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                <Briefcase class="size-3.5" />
                Anzeige ansehen
              </RouterLink>
            </div>
          </MatchScore>
          <div v-if="matches.current" class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p class="flex-1 text-xs text-muted-foreground">
              {{ matches.current.fit }}. Berechnet am {{ day(matches.current.created_at) }} mit der Version vom
              {{ day(matches.current.cv_version.created_at)
              }}{{ matches.current.cv_version.role ? ` (${matches.current.cv_version.role})` : '' }}. Ändert sich die
              aktive Version, wird dieses Ergebnis archiviert.
            </p>
            <button
              type="button"
              class="flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
              :disabled="running"
              @click="analyse"
            >
              <LoaderCircle v-if="running" class="size-3.5 animate-spin text-brand" />
              <RotateCcw v-else class="size-3.5" />
              {{ running ? 'Analyse läuft …' : 'Neu analysieren' }}
            </button>
          </div>
        </section>

        <div
          v-if="runError"
          class="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center"
          role="alert"
        >
          <span class="flex-1">{{ runError.text }}</span>
          <RouterLink
            v-if="runError.code === 'no_cv'"
            to="/cv"
            class="flex h-8 items-center justify-center rounded-md border bg-background px-3 font-medium hover:bg-accent"
          >
            Zum Lebenslauf
          </RouterLink>
          <button
            v-else-if="runError.retry"
            type="button"
            class="flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 font-medium hover:bg-accent disabled:opacity-50"
            :disabled="running"
            @click="analyse"
          >
            <RotateCcw class="size-3.5" />
            Erneut versuchen
          </button>
        </div>

        <div :class="['grid items-start gap-4', matches.archived.length && 'lg:grid-cols-[minmax(0,1fr)_20rem]']">
          <aside v-if="matches.archived.length" class="flex flex-col gap-4 lg:sticky lg:top-0 lg:order-last">
            <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
              <h2 class="text-sm font-semibold">Frühere Ergebnisse</h2>
              <div v-for="result in matches.archived" :key="result.id" class="flex items-center gap-2 py-1 text-sm">
                <span class="flex-1 text-muted-foreground">Version vom {{ day(result.cv_version.created_at) }}</span>
                <span class="font-medium">{{ result.score }}</span>
                <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Archiviert</span>
              </div>
            </section>
          </aside>

          <div v-if="matches.current" class="grid min-w-0 gap-4 md:grid-cols-2">
            <section
              v-for="list in lists"
              :key="list.title"
              :class="['flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm', list.wide && 'md:col-span-2']"
            >
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold">{{ list.title }}</h2>
                <span v-if="list.pill" :class="['rounded-full px-2 py-0.5 text-xs font-medium', list.pill]">
                  {{ list.entries.length }}
                </span>
              </div>
              <ul v-if="list.entries.length" class="flex flex-col gap-3">
                <li v-for="(entry, index) in list.entries" :key="index" class="flex flex-col text-sm">
                  <span>{{ entry.text }}</span>
                  <p class="mt-1 border-l-3 pl-3 text-xs text-muted-foreground">
                    {{
                      [
                        entry.ad_quote && `Anzeige: „${entry.ad_quote}“`,
                        entry.cv_quote && `Lebenslauf: „${entry.cv_quote}“`,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </p>
                </li>
              </ul>
              <p v-else class="text-sm text-muted-foreground">{{ list.empty }}</p>
            </section>
          </div>

          <section
            v-else-if="running"
            class="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center shadow-sm"
            role="status"
          >
            <LoaderCircle class="size-5 animate-spin text-brand" />
            <div>
              <h2 class="text-sm font-semibold">Analyse läuft …</h2>
              <p class="mt-1 text-sm text-muted-foreground">Das kann bis zu zwei Minuten dauern.</p>
            </div>
          </section>

          <section
            v-else
            class="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-12 text-center shadow-sm"
          >
            <div class="flex size-10 items-center justify-center rounded-full bg-brand/10">
              <Gauge class="size-5 text-brand" />
            </div>
            <div>
              <h2 class="text-sm font-semibold">Wie gut passt die Stelle zu dir?</h2>
              <p class="mt-1 max-w-md text-sm text-muted-foreground">
                Vergleiche die Anzeige mit deinem aktiven Lebenslauf: Score, Stärken, Lücken und Tipps.
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              @click="analyse"
            >
              Match analysieren
            </button>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Briefcase, Gauge, LoaderCircle, RotateCcw } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api'
import MatchScore from '../components/MatchScore.vue'
import PageHeader from '../components/PageHeader.vue'
import { useJobsStore } from '../stores/jobs'
import { useMatchesStore } from '../stores/matches'

const RUN_ERRORS: Record<string, string> = {
  no_cv: 'Für die Match-Analyse brauchst du einen analysierten Lebenslauf.',
  running: 'Für diese Stelle läuft schon eine Analyse.',
  limit_reached: 'Du hast heute schon fünf Match-Analysen gestartet. Morgen geht es weiter.',
  unavailable: 'Dienst gerade nicht erreichbar.',
  timeout: 'Die Analyse hat zu lange gedauert.',
}

const FINAL_ERRORS = ['no_cv', 'running', 'limit_reached']

const jobs = useJobsStore()
const matches = useMatchesStore()
const route = useRoute()
const error = ref<string | null>(null)
const running = ref(false)
const runError = ref<{ code: string; text: string; retry: boolean } | null>(null)

const lists = computed(() => {
  const result = matches.current
  if (!result) return []
  return [
    {
      title: 'Stärken',
      entries: result.strengths,
      pill: 'bg-success/10 text-success',
      empty: 'Für diese Stelle belegt der Lebenslauf keine Stärke.',
      wide: false,
    },
    {
      title: 'Lücken',
      entries: result.gaps,
      pill: 'bg-destructive/5 text-destructive',
      empty: 'Keine Lücken gefunden.',
      wide: false,
    },
    { title: 'Tipps für diese Bewerbung', entries: result.tips, pill: null, empty: 'Keine Tipps.', wide: true },
  ]
})

function day(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

async function analyse() {
  const id = Number(route.params.jobId)
  running.value = true
  runError.value = null
  try {
    await matches.run(id)
  } catch (caught) {
    const code = caught instanceof ApiError && typeof caught.detail === 'string' ? caught.detail : ''
    runError.value = {
      code,
      text:
        caught instanceof ApiError && caught.status === 404
          ? 'Diese Stelle gibt es nicht.'
          : (RUN_ERRORS[code] ?? 'Die Analyse ist fehlgeschlagen.'),
      retry: !FINAL_ERRORS.includes(code),
    }
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  const id = Number(route.params.jobId)
  try {
    await Promise.all([jobs.loadOne(id), matches.load(id)])
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.status === 404
        ? 'Diese Stelle gibt es nicht.'
        : 'Die Match-Analyse konnte nicht geladen werden.'
  }
})
</script>
