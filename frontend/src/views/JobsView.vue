<template>
  <PageHeader title="Stellen" />

  <div ref="scroller" class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1 sm:max-w-md">
          <Search class="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <input
            v-model="jobs.filter.q"
            type="search"
            placeholder="Titel, Firma oder Stadt"
            aria-label="Stellen durchsuchen"
            class="h-9 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
        </div>
        <button
          type="button"
          :class="[
            'flex h-9 shrink-0 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent',
            filtersOpen && 'bg-accent',
          ]"
          :aria-expanded="filtersOpen"
          aria-controls="job-filters"
          @click="filtersOpen = !filtersOpen"
        >
          <SlidersHorizontal class="size-4" />
          Filter
          <span v-if="activeFilters" class="rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
            {{ activeFilters }}
          </span>
        </button>
      </div>

      <section v-if="filtersOpen" id="job-filters" class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label v-for="field in FILTERS" :key="field.key" class="flex flex-col gap-2 text-sm font-medium">
            {{ field.label }}
            <select
              v-model="jobs.filter[field.key]"
              class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            >
              <option :value="null">{{ field.all }}</option>
              <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
        <div v-if="activeFilters" class="flex justify-end">
          <button
            type="button"
            class="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            @click="Object.assign(jobs.filter, { role: null, region: null, workTime: null, offerType: null })"
          >
            <X class="size-3.5" />
            Filter zurücksetzen
          </button>
        </div>
      </section>

      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <div v-if="jobs.loaded && !jobs.jobs.length" class="mt-16 flex flex-col items-center gap-3 text-center">
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Briefcase class="size-5" />
        </div>
        <template v-if="filtered">
          <h2 class="text-lg font-semibold tracking-tight">Keine passenden Stellen</h2>
          <p class="max-w-md text-sm text-muted-foreground">Ändere die Suche oder setze die Filter zurück.</p>
        </template>
        <template v-else>
          <h2 class="text-lg font-semibold tracking-tight">Noch keine Stellen im Pool</h2>
          <p class="max-w-md text-sm text-muted-foreground">
            Der Pool wird täglich aus der Jobsuche der Bundesagentur für Arbeit gefüllt.
          </p>
        </template>
      </div>

      <section v-else-if="jobs.jobs.length" class="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ul class="divide-y">
          <li v-for="row in rows" :key="row.id">
            <RouterLink :to="`/jobs/${row.id}`" class="flex gap-4 px-4 py-3.5 hover:bg-accent">
              <div class="min-w-0 flex-1">
                <p class="line-clamp-2 text-sm font-medium">{{ row.title }}</p>
                <p v-if="row.company" class="mt-0.5 truncate text-sm text-muted-foreground">{{ row.company }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span class="inline-flex items-center gap-1.5">
                    <MapPin class="size-3.5" />
                    {{ row.city }}
                  </span>
                  <span v-if="row.time" class="inline-flex items-center gap-1.5">
                    <Clock class="size-3.5" />
                    {{ row.time }}
                  </span>
                  <span v-if="row.offer" class="inline-flex items-center gap-1.5">
                    <Tag class="size-3.5" />
                    {{ row.offer }}
                  </span>
                </div>
              </div>
              <span class="shrink-0 text-xs text-muted-foreground">{{ row.age }}</span>
            </RouterLink>
          </li>
        </ul>
        <nav v-if="pageCount > 1" aria-label="Seiten" class="flex items-center justify-center gap-1 border-t px-4 py-3">
          <button
            type="button"
            class="flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            :disabled="busy || jobs.page === 1"
            @click="load(jobs.page - 1)"
          >
            <ChevronLeft class="size-4" />
            Zurück
          </button>
          <template v-for="(entry, index) in pages" :key="index">
            <span v-if="entry === '…'" class="flex size-8 items-center justify-center text-sm text-muted-foreground">…</span>
            <button
              v-else
              type="button"
              :class="[
                'flex size-8 items-center justify-center rounded-md text-sm disabled:opacity-50',
                entry === jobs.page ? 'border bg-background font-medium shadow-xs' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              ]"
              :aria-current="entry === jobs.page ? 'page' : undefined"
              :disabled="busy"
              @click="load(entry)"
            >
              {{ entry }}
            </button>
          </template>
          <button
            type="button"
            class="flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            :disabled="busy || jobs.page === pageCount"
            @click="load(jobs.page + 1)"
          >
            Weiter
            <ChevronRight class="size-4" />
          </button>
        </nav>
      </section>

      <p class="text-center text-xs text-muted-foreground">
        Pool-Stellen kommen aus der Jobsuche der Bundesagentur für Arbeit, nur Deutschland, nur die letzten 30 Tage.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Briefcase, ChevronLeft, ChevronRight, Clock, MapPin, Search, SlidersHorizontal, Tag, X } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { isAbort } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useCvStore } from '../stores/cv'
import { JOBS_PAGE_SIZE, useJobsStore } from '../stores/jobs'
import { CV_ROLES, OFFER_LABELS, REGION_LABELS } from '../types'

const SEARCH_DELAY_MS = 300
const DAY_MS = 24 * 60 * 60 * 1000

const FILTERS = [
  {
    key: 'role',
    label: 'Rolle',
    all: 'Alle Rollen',
    options: CV_ROLES.map((role) => ({ value: role, label: role })),
  },
  {
    key: 'region',
    label: 'Bundesland',
    all: 'Alle Bundesländer',
    options: Object.entries(REGION_LABELS).map(([value, label]) => ({ value, label })),
  },
  {
    key: 'workTime',
    label: 'Arbeitszeit',
    all: 'Alle Arbeitszeiten',
    options: [
      { value: 'full', label: 'Vollzeit' },
      { value: 'part', label: 'Teilzeit' },
    ],
  },
  {
    key: 'offerType',
    label: 'Angebot',
    all: 'Alle Angebote',
    options: [
      { value: 'work', label: 'Arbeit' },
      { value: 'apprenticeship', label: 'Ausbildung' },
      { value: 'internship', label: 'Praktikum' },
      { value: 'self_employment', label: 'Selbstständigkeit' },
    ],
  },
] as const

const jobs = useJobsStore()
const cv = useCvStore()
const scroller = useTemplateRef('scroller')
const filtersOpen = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
let controller: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | undefined

const activeFilters = computed(() => FILTERS.filter((field) => jobs.filter[field.key]).length)

const filtered = computed(() => Boolean(jobs.filter.q.trim() || activeFilters.value))

const pageCount = computed(() => Math.ceil(jobs.total / JOBS_PAGE_SIZE))

const pages = computed(() => {
  const shown = [...new Set([1, jobs.page - 1, jobs.page, jobs.page + 1, pageCount.value])]
    .filter((entry) => entry >= 1 && entry <= pageCount.value)
    .sort((a, b) => a - b)
  return shown.flatMap((entry, index) => {
    const gap = entry - (shown[index - 1] ?? entry)
    if (gap === 2) return [entry - 1, entry]
    return gap > 2 ? ['…' as const, entry] : [entry]
  })
})

const rows = computed(() => {
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return jobs.jobs.map((job) => {
    const days = Math.max(0, Math.round((today - Date.parse(job.published_at)) / DAY_MS))
    return {
      ...job,
      offer: OFFER_LABELS[job.offer_type],
      time: job.full_time ? (job.part_time ? 'Vollzeit, Teilzeit möglich' : 'Vollzeit') : job.part_time ? 'Teilzeit' : null,
      age: days === 0 ? 'heute' : days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`,
    }
  })
})

async function load(target = 1) {
  controller?.abort()
  const current = new AbortController()
  controller = current
  busy.value = true
  error.value = null
  try {
    await jobs.load(target, current.signal)
    scroller.value?.scrollTo({ top: 0 })
  } catch (caught) {
    if (isAbort(caught)) return
    error.value = 'Stellen konnten nicht geladen werden.'
  } finally {
    if (controller === current) busy.value = false
  }
}

watch(
  () => [jobs.filter.role, jobs.filter.region, jobs.filter.workTime, jobs.filter.offerType],
  () => load(),
)

watch(
  () => jobs.filter.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => load(), SEARCH_DELAY_MS)
  },
)

onMounted(async () => {
  if (jobs.loaded) {
    await load(jobs.page)
    return
  }
  try {
    await cv.loadActive()
  } catch {
    await load()
    return
  }
  if (cv.version?.role) jobs.filter.role = cv.version.role
  else await load()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  controller?.abort()
})
</script>
