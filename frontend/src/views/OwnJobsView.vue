<template>
  <PageHeader title="Eigene Stellen">
    <RouterLink
      v-if="jobs.ownJobs.length"
      to="/jobs/new"
      class="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Plus class="size-4" />
      <span class="hidden sm:inline">Eigene Stelle hinzufügen</span>
    </RouterLink>
  </PageHeader>

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <div v-if="loaded && !jobs.ownJobs.length" class="mt-16 flex flex-col items-center gap-3 text-center">
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Bookmark class="size-5" />
        </div>
        <h2 class="text-lg font-semibold tracking-tight">Noch keine eigenen Stellen</h2>
        <p class="max-w-md text-sm text-muted-foreground">
          Hast du eine Anzeige außerhalb des Pools gefunden? Füge ihren Text ein oder lade einen Screenshot hoch.
        </p>
        <RouterLink
          to="/jobs/new"
          class="mt-2 flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Eigene Stelle hinzufügen
        </RouterLink>
      </div>

      <section v-else-if="jobs.ownJobs.length" class="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ul class="divide-y">
          <li v-for="job in jobs.ownJobs" :key="job.id">
            <JobRow :job="job" />
          </li>
        </ul>
        <div v-if="jobs.ownJobs.length < jobs.ownTotal" class="flex justify-center border-t px-4 py-3">
          <button
            type="button"
            class="flex h-8 items-center rounded-md px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
            :disabled="busy"
            @click="more"
          >
            Weitere laden
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bookmark, Plus } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import JobRow from '../components/JobRow.vue'
import PageHeader from '../components/PageHeader.vue'
import { useJobsStore } from '../stores/jobs'

const jobs = useJobsStore()
const loaded = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    await jobs.loadOwn()
  } catch {
    error.value = 'Deine eigenen Stellen konnten nicht geladen werden.'
  } finally {
    loaded.value = true
  }
})

async function more() {
  error.value = null
  busy.value = true
  try {
    await jobs.loadOwn(jobs.ownJobs.length)
  } catch {
    error.value = 'Weitere Stellen konnten nicht geladen werden.'
  } finally {
    busy.value = false
  }
}
</script>
