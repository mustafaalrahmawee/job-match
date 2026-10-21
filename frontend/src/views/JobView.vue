<template>
  <PageHeader :title="jobs.job ? [jobs.job.title, jobs.job.company].filter(Boolean).join(' · ') : 'Stelle'">
    <RouterLink
      :to="jobs.job?.source === 'own' ? '/jobs/own' : '/jobs'"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      <span class="hidden sm:inline">{{ jobs.job?.source === 'own' ? 'Eigene Stellen' : 'Alle Stellen' }}</span>
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
              <span v-if="jobs.job.salary" class="inline-flex items-center gap-1.5">
                <Banknote class="size-4" />
                {{ jobs.job.salary }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <CalendarDays class="size-4" />
                {{ jobs.job.source === 'own' ? 'Gespeichert' : 'Veröffentlicht' }} am {{ facts.published }}
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

        <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <aside class="flex flex-col gap-4 lg:sticky lg:top-0 lg:order-last">
            <section v-if="matches.current" class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <MatchScore :score="matches.current.score">
                <div class="min-w-0 flex-1">
                  <h2 class="text-sm font-semibold">{{ matches.current.fit }}</h2>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    Berechnet am {{ new Date(matches.current.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) }}
                  </p>
                </div>
              </MatchScore>
              <RouterLink
                :to="`/matches/${jobs.job.id}`"
                class="flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Analyse ansehen
              </RouterLink>
            </section>

            <section v-else class="flex flex-col items-center gap-3 rounded-xl border bg-card p-4 text-center shadow-sm">
              <div class="mt-2 flex size-10 items-center justify-center rounded-full bg-brand/10">
                <Gauge class="size-5 text-brand" />
              </div>
              <div>
                <h2 class="text-sm font-semibold">Wie gut passt die Stelle zu dir?</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  Vergleiche die Anzeige mit deinem aktiven Lebenslauf: Score, Stärken, Lücken und Tipps.
                </p>
              </div>
              <RouterLink
                :to="`/matches/${jobs.job.id}`"
                class="flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Zur Match-Analyse
              </RouterLink>
            </section>
          </aside>

          <div class="flex min-w-0 flex-col gap-4">
            <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
              <h2 class="text-sm font-semibold">Anzeige</h2>
              <MarkdownText :text="jobs.job.description" class="max-w-prose text-sm text-muted-foreground" />
              <p class="mt-2 border-t pt-3 text-xs text-muted-foreground">
                {{ jobs.job.source === 'own' ? 'Quelle: eigene Stelle' : 'Quelle: Jobsuche der Bundesagentur für Arbeit' }}
              </p>
            </section>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Banknote, CalendarDays, Clock, ExternalLink, Gauge, MapPin, Tag } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api'
import MarkdownText from '../components/MarkdownText.vue'
import MatchScore from '../components/MatchScore.vue'
import PageHeader from '../components/PageHeader.vue'
import { useJobsStore } from '../stores/jobs'
import { useMatchesStore } from '../stores/matches'
import { OFFER_LABELS, REGION_LABELS } from '../types'

const jobs = useJobsStore()
const matches = useMatchesStore()
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
  const id = Number(route.params.id)
  try {
    await Promise.all([jobs.loadOne(id), matches.load(id)])
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.status === 404
        ? 'Diese Stelle gibt es nicht.'
        : 'Die Stelle konnte nicht geladen werden.'
  }
})
</script>
