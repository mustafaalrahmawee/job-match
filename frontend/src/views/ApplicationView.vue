<template>
  <PageHeader :title="item ? [item.job.title, item.job.company].filter(Boolean).join(' · ') : 'Bewerbung'">
    <RouterLink
      to="/applications"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      <span class="hidden sm:inline">Bewerbungen</span>
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <div v-if="item" class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div class="flex min-w-0 flex-col gap-4">
          <section class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-start">
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold tracking-tight">{{ item.job.title }}</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ facts }} ·
                <RouterLink :to="`/matches/${item.job.id}`" class="font-medium text-foreground underline-offset-4 hover:underline">
                  {{ item.match_score === null ? 'Match-Analyse' : `Match ${item.match_score}` }}
                </RouterLink>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <label for="status" class="text-xs text-muted-foreground">Status</label>
              <select
                id="status"
                :value="item.status"
                :disabled="saving"
                class="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50"
                @change="changeStatus"
              >
                <option v-for="(label, status) in APPLICATION_STATUS_LABELS" :key="status" :value="status">
                  {{ label }}
                </option>
              </select>
            </div>
          </section>

          <section class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div class="flex items-center gap-2">
              <h2 class="flex-1 text-sm font-semibold">Notizen</h2>
              <button
                type="button"
                class="flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
                :disabled="adding || !draft.trim()"
                @click="saveNote"
              >
                <Plus class="size-3.5" />
                {{ adding ? 'Speichern …' : 'Notiz' }}
              </button>
            </div>
            <p v-if="noteError" class="text-sm text-destructive" role="alert">{{ noteError }}</p>
            <div v-if="item.notes.length" class="flex flex-col gap-2">
              <div v-for="note in item.notes" :key="note.id" class="rounded-md bg-muted p-3">
                <p class="text-sm whitespace-pre-line">{{ note.content }}</p>
                <p class="mt-1.5 text-xs text-muted-foreground">{{ when(note.created_at) }}</p>
              </div>
            </div>
            <p v-else class="text-sm text-muted-foreground">Noch keine Notizen.</p>
            <label for="note" class="sr-only">Neue Notiz</label>
            <textarea
              id="note"
              v-model="draft"
              rows="2"
              maxlength="5000"
              placeholder="Neue Notiz …"
              class="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
          </section>
        </div>

        <aside class="flex flex-col gap-4 lg:sticky lg:top-0">
          <section class="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
            <h2 class="text-sm font-semibold">Verlauf</h2>
            <ul class="flex flex-col gap-3">
              <li v-for="(step, index) in item.history" :key="index" class="flex gap-3">
                <span
                  :class="['mt-1.5 size-2 shrink-0 rounded-full', index === 0 ? 'bg-foreground' : 'bg-muted-foreground']"
                />
                <span class="flex-1">
                  <span class="block text-sm font-medium">{{ APPLICATION_STATUS_LABELS[step.status] }}</span>
                  <span class="block text-xs text-muted-foreground">{{ when(step.changed_at, true) }}</span>
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Plus } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { useApplicationsStore } from '../stores/applications'
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '../types'

const applications = useApplicationsStore()
const route = useRoute()
const error = ref<string | null>(null)
const noteError = ref<string | null>(null)
const saving = ref(false)
const adding = ref(false)
const draft = ref('')

const item = computed(() => applications.application)

const facts = computed(() => {
  const job = item.value?.job
  if (!job) return ''
  return [
    job.company,
    job.city,
    job.full_time ? 'Vollzeit' : job.part_time ? 'Teilzeit' : null,
    job.source === 'own' ? 'eigene Stelle' : 'aus dem Pool',
  ]
    .filter(Boolean)
    .join(' · ')
})

function when(date: string, withYear = false) {
  return new Date(date).toLocaleString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function changeStatus(event: Event) {
  const current = item.value
  const select = event.target as HTMLSelectElement
  if (!current) return
  saving.value = true
  error.value = null
  try {
    await applications.setStatus(current.id, select.value as ApplicationStatus)
  } catch {
    select.value = current.status
    error.value = 'Der Status konnte nicht gespeichert werden.'
  } finally {
    saving.value = false
  }
}

async function saveNote() {
  const current = item.value
  const content = draft.value.trim()
  if (!current || !content) return
  adding.value = true
  noteError.value = null
  try {
    await applications.addNote(current.id, content)
    draft.value = ''
  } catch {
    noteError.value = 'Die Notiz konnte nicht gespeichert werden.'
  } finally {
    adding.value = false
  }
}

onMounted(async () => {
  try {
    await applications.load(Number(route.params.id))
  } catch (caught) {
    error.value =
      caught instanceof ApiError && caught.status === 404
        ? 'Diese Bewerbung gibt es nicht.'
        : 'Die Bewerbung konnte nicht geladen werden.'
  }
})
</script>
