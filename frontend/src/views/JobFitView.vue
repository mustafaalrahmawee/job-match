<template>
  <PageHeader title="Passt zu dir" />

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div v-if="problem === 'no_cv'" class="mt-16 flex flex-col items-center gap-3 text-center">
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <FileText class="size-5" />
        </div>
        <h2 class="text-lg font-semibold tracking-tight">Noch kein analysierter Lebenslauf</h2>
        <p class="max-w-md text-sm text-muted-foreground">Für diese Liste brauchst du einen analysierten Lebenslauf.</p>
        <RouterLink
          to="/cv"
          class="flex h-8 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          Zum Lebenslauf
        </RouterLink>
      </div>

      <template v-else>
        <section class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
          <div class="min-w-0 flex-1 text-sm">
            <p v-if="jobs.fit">
              Verglichen mit deinem Lebenslauf vom {{ day(jobs.fit.cv_version.created_at) }}
              <RouterLink to="/cv" class="ml-1 font-medium text-brand hover:underline">Lebenslauf</RouterLink>
            </p>
          </div>
          <label class="flex flex-col gap-2 text-sm font-medium sm:w-64">
            Rolle
            <select
              v-model="role"
              class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option :value="null">Alle Rollen</option>
              <option v-for="entry in CV_ROLES" :key="entry" :value="entry">{{ entry }}</option>
            </select>
            <span class="text-xs font-normal text-muted-foreground">Eigene Stellen erscheinen bei jeder Rolle.</span>
          </label>
        </section>

        <p class="text-sm text-muted-foreground">
          Die 20 Stellen aus dem Pool und deinen eigenen Stellen, deren Text deinem aktiven Lebenslauf am ähnlichsten
          ist. Die Reihenfolge ist keine Bewertung, auch die erste Stelle kann schlecht passen. Wie gut eine Stelle
          wirklich passt, zeigt die Match-Analyse in der Stelle.
        </p>

        <div
          v-if="problem"
          class="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center"
          role="alert"
        >
          <span class="flex-1">{{ MESSAGES[problem] }}</span>
          <button
            v-if="problem !== 'retry_failed'"
            type="button"
            class="flex h-8 items-center justify-center gap-2 rounded-md border bg-background px-3 font-medium hover:bg-accent disabled:opacity-50"
            :disabled="loading"
            @click="problem === 'not_embedded' ? prepare() : load()"
          >
            <RotateCcw class="size-3.5" />
            Erneut versuchen
          </button>
          <RouterLink
            to="/jobs"
            class="flex h-8 items-center justify-center rounded-md border bg-background px-3 font-medium hover:bg-accent"
          >
            Zu allen Stellen
          </RouterLink>
        </div>

        <p v-else-if="loading" class="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
          <LoaderCircle class="size-4 animate-spin" />
          Passende Stellen werden gesucht …
        </p>

        <div v-else-if="jobs.fit && !jobs.fit.jobs.length" class="mt-16 flex flex-col items-center gap-3 text-center">
          <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Briefcase class="size-5" />
          </div>
          <template v-if="role">
            <h2 class="text-lg font-semibold tracking-tight">Keine Stellen für diese Rolle</h2>
            <p class="max-w-md text-sm text-muted-foreground">Wähle „Alle Rollen“ oder sieh dir alle Stellen an.</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex h-8 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
                @click="role = null"
              >
                Alle Rollen
              </button>
              <RouterLink
                to="/jobs"
                class="flex h-8 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                Zu allen Stellen
              </RouterLink>
            </div>
          </template>
          <template v-else>
            <h2 class="text-lg font-semibold tracking-tight">Gerade keine Stellen</h2>
            <p class="max-w-md text-sm text-muted-foreground">
              Der Pool wird täglich aus der Jobsuche der Bundesagentur für Arbeit gefüllt.
            </p>
            <RouterLink
              to="/jobs/new"
              class="flex h-8 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              Eigene Stelle speichern
            </RouterLink>
          </template>
        </div>

        <section v-else-if="jobs.fit" class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul class="divide-y">
            <li v-for="job in jobs.fit.jobs" :key="job.id">
              <JobRow :job="job" show-source />
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Briefcase, FileText, LoaderCircle, RotateCcw } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError, isAbort } from '../api'
import JobRow from '../components/JobRow.vue'
import PageHeader from '../components/PageHeader.vue'
import { useCvStore } from '../stores/cv'
import { useJobsStore } from '../stores/jobs'
import { CV_ROLES, type CvRole } from '../types'

type Problem = 'no_cv' | 'not_embedded' | 'retry_failed' | 'unavailable' | 'other'

const MESSAGES: Record<Problem, string> = {
  no_cv: 'Noch kein analysierter Lebenslauf',
  not_embedded: 'Dein Lebenslauf ist für den Vergleich noch nicht vorbereitet.',
  retry_failed: 'Das hat nicht geklappt. Versuche es später noch einmal oder sieh dir alle Stellen an.',
  unavailable: 'Dienst gerade nicht erreichbar.',
  other: 'Die passenden Stellen konnten nicht geladen werden.',
}

const jobs = useJobsStore()
const cv = useCvStore()
const role = ref<CvRole | null>(null)
const loading = ref(false)
const problem = ref<Problem | null>(null)
let controller: AbortController | null = null

function day(value: string): string {
  return new Date(value).toLocaleDateString('de-DE', { dateStyle: 'medium' })
}

async function load() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  problem.value = null
  try {
    await jobs.loadFit(role.value, current.signal)
  } catch (caught) {
    if (isAbort(caught)) return
    const detail = caught instanceof ApiError ? caught.detail : null
    problem.value =
      detail === 'no_cv' || detail === 'not_embedded' || detail === 'unavailable' ? detail : 'other'
  } finally {
    if (controller === current) loading.value = false
  }
}

async function prepare() {
  loading.value = true
  try {
    if (!cv.version) await cv.loadActive()
    if (!cv.version) throw new Error('no active version')
    await cv.activate(cv.version.id)
    await load()
    if (problem.value === 'not_embedded') problem.value = 'retry_failed'
  } catch {
    problem.value = 'retry_failed'
    loading.value = false
  }
}

watch(role, () => load())

onMounted(async () => {
  try {
    await cv.loadActive()
  } catch {
    await load()
    return
  }
  if (cv.version?.role) role.value = cv.version.role
  else await load()
})

onBeforeUnmount(() => controller?.abort())
</script>
