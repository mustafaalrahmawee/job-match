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
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
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

      <div v-else-if="cv.version" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside class="flex flex-col gap-4 lg:sticky lg:top-0 lg:order-last">
          <section v-if="analysis" class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div class="flex items-center gap-2">
              <h2 class="flex-1 text-sm font-semibold">Zielrolle</h2>
              <span
                v-if="cv.version.role"
                class="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
              >
                Bestätigt
              </span>
            </div>
            <p class="text-sm text-muted-foreground">
              Vorgeschlagen: <span class="font-medium text-foreground">{{ analysis.suggested_role }}</span>. Stellen,
              Match und Coach arbeiten mit der Rolle, die du bestätigst.
            </p>
            <div class="flex gap-2">
              <select
                v-model="role"
                aria-label="Zielrolle"
                class="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option v-for="option in ROLES" :key="option" :value="option">{{ option }}</option>
              </select>
              <button
                type="button"
                class="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                :disabled="busy || role === cv.version.role"
                @click="confirmRole"
              >
                Bestätigen
              </button>
            </div>
          </section>

          <section class="flex flex-col gap-1 rounded-xl border bg-card p-2 shadow-sm">
            <h2 class="px-2 pt-2 pb-1 text-sm font-semibold">Versionen</h2>
            <div class="flex items-center gap-2 rounded-md bg-accent/60 px-2 py-2">
              <div class="min-w-0 flex-1 text-sm">
                <p class="truncate font-medium">{{ new Date(cv.version.created_at).toLocaleString('de-DE', DATE_FORMAT) }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ STATES[cv.version.status] }}<template v-if="cv.version.role"> · {{ cv.version.role }}</template>
                </p>
              </div>
              <span class="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">Aktiv</span>
            </div>
            <div v-for="entry in archived" :key="entry.id" class="flex items-center gap-1 rounded-md px-2 py-2 hover:bg-accent">
              <div class="min-w-0 flex-1 text-sm">
                <p class="truncate">{{ new Date(entry.created_at).toLocaleString('de-DE', DATE_FORMAT) }}</p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ STATES[entry.status] }}<template v-if="entry.role"> · {{ entry.role }}</template>
                </p>
              </div>
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
                :disabled="busy"
                @click="activate(entry.id)"
              >
                <ArchiveRestore class="size-3.5" />
                Aktivieren
              </button>
              <button
                type="button"
                class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive disabled:opacity-50"
                aria-label="Version löschen"
                title="Version löschen"
                :disabled="busy"
                @click="openDelete(entry)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
            <p v-if="!archived.length" class="px-2 pb-2 text-xs text-muted-foreground">
              Lädst du eine neue Version hoch, bleibt diese hier archiviert.
            </p>
          </section>
        </aside>

        <div class="flex flex-col gap-4">
          <div
            v-if="cv.version.status === 'running'"
            class="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-sm"
            role="status"
          >
            <LoaderCircle class="size-4 animate-spin text-brand" />
            <span class="flex-1">Wird analysiert … Das kann ein paar Minuten dauern.</span>
          </div>

          <div
            v-else-if="cv.version.status !== 'ready'"
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

            <div class="grid gap-4 md:grid-cols-2">
              <section v-if="analysis.education.length" class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
                <h2 class="text-sm font-semibold">Ausbildung</h2>
                <ul class="flex flex-col gap-2 text-sm">
                  <li v-for="(entry, index) in analysis.education" :key="index">
                    <p class="font-medium">{{ entry.degree }}</p>
                    <p class="text-muted-foreground">
                      {{ entry.institution }}<template v-if="entry.year"> · {{ entry.year }}</template>
                    </p>
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
                :class="['flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm', list.key === 'tips' && 'md:col-span-2']"
              >
                <h2 class="text-sm font-semibold">{{ list.title }}</h2>
                <ul class="flex list-disc flex-col gap-1 pl-5 text-sm">
                  <li v-for="(item, index) in analysis[list.key]" :key="index">{{ item }}</li>
                </ul>
              </section>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <AppDialog
    :open="deleting !== null"
    title="Version löschen?"
    confirm-label="Löschen"
    destructive
    :disabled="busy"
    :error="dialogError"
    @confirm="confirmDelete"
    @cancel="deleting = null"
  >
    <p class="text-sm text-muted-foreground">
      Die Version wird mit ihrer Analyse und ihren Match-Ergebnissen gelöscht. Bewerbungen, Chats und Trainings bleiben.
    </p>
  </AppDialog>
</template>

<script setup lang="ts">
import { ArchiveRestore, FileText, LoaderCircle, RotateCcw, Trash2, Upload } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { ApiError } from '../api'
import AppDialog from '../components/AppDialog.vue'
import PageHeader from '../components/PageHeader.vue'
import { useCvStore } from '../stores/cv'
import type { AnalysisStatus, CvRole, CvVersionSummary } from '../types'

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

const STATES: Record<AnalysisStatus, string> = {
  none: 'Nicht analysiert',
  running: 'Wird analysiert',
  ready: 'Analysiert',
  failed: 'Analyse fehlgeschlagen',
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

const MAX_BYTES = 5 * 1024 * 1024
const POLL_MS = 15000

const cv = useCvStore()
const picker = useTemplateRef('picker')
const loaded = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const role = ref<CvRole>('Andere')
const deleting = ref<CvVersionSummary | null>(null)
const dialogError = ref<string | null>(null)
const analysis = computed(() => (cv.version?.status === 'ready' ? cv.version.analysis : null))
const archived = computed(() => cv.versions.filter((entry) => !entry.active))
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
    await Promise.all([cv.loadActive(), cv.loadVersions()])
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
    return
  } finally {
    busy.value = false
  }
  await reloadVersions()
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

async function activate(id: number) {
  error.value = null
  busy.value = true
  try {
    await cv.activate(id)
  } catch {
    error.value = 'Die Version konnte nicht aktiviert werden.'
    return
  } finally {
    busy.value = false
  }
  await reloadVersions()
}

async function reloadVersions() {
  try {
    await cv.loadVersions()
  } catch {
    error.value = 'Die Liste der Versionen konnte nicht neu geladen werden.'
  }
}

function openDelete(entry: CvVersionSummary) {
  dialogError.value = null
  deleting.value = entry
}

async function confirmDelete() {
  const entry = deleting.value
  if (!entry) return
  busy.value = true
  try {
    await cv.remove(entry.id)
    deleting.value = null
  } catch {
    dialogError.value = 'Löschen hat nicht geklappt.'
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
