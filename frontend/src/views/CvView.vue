<template>
  <PageHeader title="Lebenslauf">
    <button
      type="button"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      :disabled="busy"
      @click="picker?.click()"
    >
      <Upload class="size-4" />
      <span class="hidden sm:inline">{{ cv.version ? 'Neue Version hochladen' : 'PDF hochladen' }}</span>
    </button>
    <input ref="picker" type="file" accept="application/pdf" class="hidden" @change="pick" />
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <p
        v-if="error"
        class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        role="alert"
      >
        {{ error }}
      </p>

      <div v-if="loaded && !cv.version" class="mt-16 flex flex-col items-center gap-3 text-center">
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <FileText class="size-5" />
        </div>
        <h2 class="text-lg font-semibold tracking-tight">Noch kein Lebenslauf hinterlegt</h2>
        <p class="max-w-md text-sm text-muted-foreground">
          Lade deinen Lebenslauf als PDF hoch (Deutsch oder Englisch, höchstens 5 MB). Er wird einmal analysiert.
        </p>
        <button
          type="button"
          class="mt-2 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          :disabled="busy"
          @click="picker?.click()"
        >
          PDF hochladen
        </button>
      </div>

      <div
        v-else-if="cv.version?.status === 'running'"
        class="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm"
        role="status"
      >
        <LoaderCircle class="size-4 animate-spin text-brand" />
        <span class="flex-1">Wird analysiert … Das kann ein paar Minuten dauern.</span>
      </div>

      <div
        v-else-if="cv.version && cv.version.status !== 'ready'"
        class="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        role="alert"
      >
        <span class="flex-1">{{ REASONS[cv.version.error ?? ''] ?? 'Die Analyse ist fehlgeschlagen.' }}</span>
        <button
          v-if="FINAL_ERRORS.includes(cv.version.error ?? '')"
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 font-medium hover:bg-accent disabled:opacity-50"
          :disabled="busy"
          @click="picker?.click()"
        >
          <Upload class="size-3.5" />
          Andere Datei hochladen
        </button>
        <button
          v-else
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 font-medium hover:bg-accent disabled:opacity-50"
          :disabled="busy"
          @click="retry"
        >
          <RotateCcw class="size-3.5" />
          Erneut versuchen
        </button>
      </div>

      <template v-else-if="analysis">
        <section class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div class="flex items-center gap-2">
            <h2 class="flex-1 text-sm font-semibold">Zielrolle</h2>
            <span
              v-if="cv.version?.role"
              class="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
            >
              Bestätigt
            </span>
          </div>
          <p class="text-sm text-muted-foreground">
            Vorgeschlagen: <span class="font-medium text-foreground">{{ analysis.suggested_role }}</span>. Stellen,
            Match und Coach arbeiten mit der Rolle, die du bestätigst.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <select
              v-model="role"
              aria-label="Zielrolle"
              class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option v-for="option in ROLES" :key="option" :value="option">{{ option }}</option>
            </select>
            <button
              type="button"
              class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              :disabled="busy || role === cv.version?.role"
              @click="confirmRole"
            >
              Rolle bestätigen
            </button>
          </div>
        </section>

        <section v-if="analysis.positions.length" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <h2 class="text-sm font-semibold">Stationen</h2>
          <ul class="flex flex-col gap-2 text-sm">
            <li v-for="(position, index) in analysis.positions" :key="index">
              <p class="font-medium">{{ position.title }}</p>
              <p class="text-muted-foreground">
                {{ position.employer }} · {{ position.start ?? '?' }} – {{ position.end ?? 'heute' }}
              </p>
            </li>
          </ul>
        </section>

        <section v-if="analysis.skills.length" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <h2 class="text-sm font-semibold">Kenntnisse</h2>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="skill in analysis.skills"
              :key="skill"
              class="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
            >
              {{ skill }}
            </span>
          </div>
        </section>

        <section v-if="analysis.education.length" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <h2 class="text-sm font-semibold">Ausbildung</h2>
          <ul class="flex flex-col gap-2 text-sm">
            <li v-for="(entry, index) in analysis.education" :key="index">
              <p class="font-medium">{{ entry.degree }}</p>
              <p class="text-muted-foreground">{{ entry.institution }}<template v-if="entry.year"> · {{ entry.year }}</template></p>
            </li>
          </ul>
        </section>

        <section v-if="analysis.languages.length" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <h2 class="text-sm font-semibold">Sprachen</h2>
          <ul class="flex flex-col gap-1 text-sm">
            <li v-for="language in analysis.languages" :key="language.name">
              {{ language.name }}<span v-if="language.level" class="text-muted-foreground"> · {{ language.level }}</span>
            </li>
          </ul>
        </section>

        <section
          v-for="list in LISTS"
          v-show="analysis[list.key].length"
          :key="list.key"
          class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
        >
          <h2 class="text-sm font-semibold">{{ list.title }}</h2>
          <ul class="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li v-for="(item, index) in analysis[list.key]" :key="index">{{ item }}</li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileText, LoaderCircle, RotateCcw, Upload } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { ApiError } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useCvStore } from '../stores/cv'
import type { CvRole } from '../types'

const ROLES: CvRole[] = [
  'Frontend',
  'Backend',
  'Fullstack',
  'Mobile',
  'Data',
  'DevOps',
  'QA',
  'UX/UI',
  'IT-Support',
  'IT-Projektmanagement',
  'Andere',
]

const LISTS = [
  { key: 'strengths', title: 'Stärken' },
  { key: 'weaknesses', title: 'Schwächen' },
  { key: 'tips', title: 'Tipps' },
] as const

const REASONS: Record<string, string> = {
  not_cv: 'Die Datei sieht nicht wie ein Lebenslauf aus. Bitte lade deinen Lebenslauf hoch.',
  language: 'Der Lebenslauf ist weder auf Deutsch noch auf Englisch.',
  refused: 'Die Analyse wurde abgelehnt.',
  too_long: 'Der Lebenslauf ist zu lang für die Analyse.',
  invalid_output: 'Die Analyse hat kein gültiges Ergebnis geliefert.',
  batch_failed: 'Die Analyse ist fehlgeschlagen.',
  submit_failed: 'Die Analyse konnte nicht gestartet werden.',
}

const FINAL_ERRORS = ['not_cv', 'language']

const MAX_BYTES = 5 * 1024 * 1024
const POLL_MS = 15000

const cv = useCvStore()
const picker = useTemplateRef('picker')
const loaded = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const role = ref<CvRole>('Andere')
const analysis = computed(() => (cv.version?.status === 'ready' ? cv.version.analysis : null))
let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => cv.version,
  (version) => {
    clearTimeout(timer)
    if (version?.status === 'running') timer = setTimeout(poll, POLL_MS)
    if (version?.analysis) role.value = version.role ?? version.analysis.suggested_role
  },
)

onMounted(async () => {
  try {
    await cv.loadActive()
  } catch {
    error.value = 'Der Lebenslauf konnte nicht geladen werden.'
  } finally {
    loaded.value = true
  }
})

onBeforeUnmount(() => clearTimeout(timer))

async function poll() {
  try {
    await cv.loadActive()
    error.value = null
  } catch {
    error.value = 'Der Status konnte nicht abgefragt werden.'
    timer = setTimeout(poll, POLL_MS)
  }
}

async function pick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = null
  if (file.type && file.type !== 'application/pdf') {
    error.value = 'Bitte eine PDF-Datei wählen.'
    return
  }
  if (file.size > MAX_BYTES) {
    error.value = 'Die Datei ist größer als 5 MB.'
    return
  }
  busy.value = true
  try {
    await cv.upload(file)
  } catch (failure) {
    const status = failure instanceof ApiError ? failure.status : 0
    if (status === 413) error.value = 'Die Datei ist größer als 5 MB.'
    else if (status === 422) error.value = 'Die Datei ist kein gültiges PDF.'
    else error.value = 'Hochladen hat nicht geklappt.'
  } finally {
    busy.value = false
  }
}

async function retry() {
  error.value = null
  busy.value = true
  try {
    await cv.retry()
  } catch {
    error.value = 'Der neue Versuch hat nicht geklappt.'
  } finally {
    busy.value = false
  }
}

async function confirmRole() {
  error.value = null
  busy.value = true
  try {
    await cv.confirmRole(role.value)
  } catch {
    error.value = 'Die Rolle konnte nicht gespeichert werden.'
  } finally {
    busy.value = false
  }
}
</script>
