<template>
  <PageHeader title="Bewerbungen">
    <RouterLink
      to="/jobs"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Plus class="size-4" />
      <span class="hidden sm:inline">Bewerbung anlegen</span>
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <div v-if="loaded && !applications.list.length" class="mt-16 flex flex-col items-center gap-3 text-center">
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <ClipboardList class="size-5" />
        </div>
        <h2 class="text-lg font-semibold tracking-tight">Noch keine Bewerbungen</h2>
        <p class="max-w-md text-sm text-muted-foreground">
          Öffne eine Stelle und lege dort eine Bewerbung an. Hier siehst du dann Status, Verlauf und Notizen aller
          Bewerbungen.
        </p>
        <RouterLink
          to="/jobs"
          class="mt-2 flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Zu den Stellen
        </RouterLink>
      </div>

      <template v-else-if="applications.list.length">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <section
            v-for="(label, status) in APPLICATION_STATUS_LABELS"
            :key="status"
            class="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3 shadow-sm"
          >
            <span class="text-xs text-muted-foreground">{{ label }}</span>
            <span class="text-xl font-semibold">{{ applications.list.filter((item) => item.status === status).length }}</span>
          </section>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="option in FILTERS"
            :key="option.value"
            type="button"
            :class="[
              'h-8 rounded-full border px-3 text-sm',
              filter === option.value
                ? 'border-primary bg-primary font-medium text-primary-foreground'
                : 'bg-background hover:bg-accent',
            ]"
            :aria-pressed="filter === option.value"
            @click="filter = option.value"
          >
            {{ option.label }}
          </button>
          <span class="flex-1" />
          <span class="text-xs text-muted-foreground">Sortiert nach letzter Änderung</span>
        </div>

        <section class="flex flex-col rounded-xl border bg-card p-2 shadow-sm">
          <div class="hidden items-center gap-4 px-2 pt-2 pb-3 text-xs font-medium text-muted-foreground md:flex">
            <span class="flex-1">Stelle</span>
            <span class="w-30">Beworben am</span>
            <span class="w-40">Letzte Änderung</span>
            <span class="w-30">Status</span>
          </div>
          <p v-if="!visible.length" class="px-2 py-3 text-sm text-muted-foreground">Keine Bewerbungen in diesem Filter.</p>
          <RouterLink
            v-for="item in visible"
            :key="item.id"
            :to="`/applications/${item.id}`"
            class="flex items-center gap-4 rounded-md border-t px-2 py-3 first-of-type:border-t-0 hover:bg-accent md:first-of-type:border-t"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">
                {{ [item.job.title, item.job.company].filter(Boolean).join(' · ') }}
              </span>
              <span class="block truncate text-xs text-muted-foreground">
                {{
                  [
                    item.job.city,
                    item.match_score !== null && `Match ${item.match_score}`,
                    item.notes && (item.notes === 1 ? '1 Notiz' : `${item.notes} Notizen`),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
            </span>
            <span class="hidden w-30 text-xs text-muted-foreground md:block">
              {{ item.applied_at ? new Date(item.applied_at).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : '—' }}
            </span>
            <span class="hidden w-40 text-xs text-muted-foreground md:block">
              {{ ago(item.changed_at) }}, {{ APPLICATION_STATUS_LABELS[item.status] }}
            </span>
            <span class="flex w-30 shrink-0 justify-end md:justify-start">
              <StatusPill :status="item.status" />
            </span>
          </RouterLink>
        </section>

        <p class="text-xs text-muted-foreground">
          Die Liste bleibt auch nach einem Rollenwechsel oder einer neuen Lebenslauf-Version vollständig; der Match
          bezieht sich immer auf die aktive Version.
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Plus } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import { useApplicationsStore } from '../stores/applications'
import { APPLICATION_STATUS_LABELS, OPEN_STATUSES } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

const FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'open', label: 'Offen' },
  { value: 'closed', label: 'Abgeschlossen' },
] as const

const applications = useApplicationsStore()
const error = ref<string | null>(null)
const loaded = ref(false)
const filter = ref<(typeof FILTERS)[number]['value']>('all')

const visible = computed(() =>
  applications.list.filter(
    (item) => filter.value === 'all' || OPEN_STATUSES.includes(item.status) === (filter.value === 'open'),
  ),
)

function ago(date: string) {
  const now = new Date()
  const then = new Date(date)
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      DAY_MS,
  )
  return days <= 0 ? 'heute' : days === 1 ? 'gestern' : `vor ${days} Tagen`
}

onMounted(async () => {
  try {
    await applications.loadList()
    loaded.value = true
  } catch {
    error.value = 'Die Bewerbungen konnten nicht geladen werden.'
  }
})
</script>
