<template>
  <PageHeader :title="jobs.job ? [jobs.job.title, jobs.job.company].filter(Boolean).join(' · ') : 'Stelle'">
    <RouterLink
      to="/jobs"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      <span class="hidden sm:inline">Alle Stellen</span>
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <template v-if="jobs.job">
        <section class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start">
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold tracking-tight">{{ jobs.job.title }}</h2>
            <p v-if="jobs.job.company" class="mt-0.5 text-sm text-muted-foreground">{{ jobs.job.company }}</p>
            <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span class="inline-flex items-center gap-1.5">
                <MapPin class="size-4" />
                {{ facts.place }}
              </span>
              <span v-if="facts.time" class="inline-flex items-center gap-1.5">
                <Clock class="size-4" />
                {{ facts.time }}
              </span>
              <span v-if="facts.offer" class="inline-flex items-center gap-1.5">
                <Tag class="size-4" />
                {{ facts.offer }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <CalendarDays class="size-4" />
                Veröffentlicht am {{ facts.published }}
              </span>
            </div>
          </div>
          <a
            v-if="jobs.job.url"
            :href="jobs.job.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <ExternalLink class="size-4" />
            Bei der Bundesagentur ansehen
          </a>
        </section>

        <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <h2 class="text-sm font-semibold">Anzeige</h2>
          <MarkdownText :text="jobs.job.description" class="text-sm text-muted-foreground" />
          <p class="mt-2 border-t pt-3 text-xs text-muted-foreground">Quelle: Jobsuche der Bundesagentur für Arbeit</p>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, CalendarDays, Clock, ExternalLink, MapPin, Tag } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api'
import MarkdownText from '../components/MarkdownText.vue'
import PageHeader from '../components/PageHeader.vue'
import { useJobsStore } from '../stores/jobs'
import { OFFER_LABELS, REGION_LABELS } from '../types'

const jobs = useJobsStore()
const route = useRoute()
const error = ref<string | null>(null)

const facts = computed(() => {
  const job = jobs.job
  if (!job) return { place: '', time: null, offer: null, published: '' }
  const region = job.region ? REGION_LABELS[job.region] : null
  return {
    place: region && region !== job.city ? `${job.city}, ${region}` : job.city,
    time: job.full_time ? (job.part_time ? 'Vollzeit, Teilzeit möglich' : 'Vollzeit') : job.part_time ? 'Teilzeit' : null,
    offer: OFFER_LABELS[job.offer_type],
    published: new Date(job.published_at).toLocaleDateString('de-DE', { dateStyle: 'medium' }),
  }
})

onMounted(async () => {
  try {
    await jobs.loadOne(Number(route.params.id))
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.status === 404
        ? 'Diese Stelle gibt es nicht.'
        : 'Die Stelle konnte nicht geladen werden.'
  }
})
</script>
