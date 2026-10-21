<template>
  <PageHeader title="Matches" />

  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
        {{ error }}
      </p>

      <div v-if="loaded && !matches.list.length" class="mt-16 flex flex-col items-center gap-3 text-center">
        <div class="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Gauge class="size-5" />
        </div>
        <h2 class="text-lg font-semibold tracking-tight">Noch keine Match-Analysen</h2>
        <p class="max-w-md text-sm text-muted-foreground">
          Öffne eine Stelle und starte dort die Match-Analyse. Hier siehst du dann alle Ergebnisse deines aktiven
          Lebenslaufs, die beste Passung zuerst.
        </p>
        <RouterLink
          to="/jobs"
          class="mt-2 flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Zu den Stellen
        </RouterLink>
      </div>

      <template v-else-if="matches.list.length">
        <p class="text-sm text-muted-foreground">
          Ergebnisse deines aktiven Lebenslaufs, die beste Passung zuerst. Ergebnisse früherer Versionen findest du in
          der Match-Analyse der Stelle.
        </p>
        <section class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <ul class="divide-y">
            <li v-for="match in matches.list" :key="match.id">
              <RouterLink :to="`/matches/${match.job.id}`" class="flex gap-4 px-4 py-3.5 hover:bg-accent">
                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 text-sm font-medium">{{ match.job.title }}</p>
                  <p class="mt-0.5 truncate text-sm text-muted-foreground">
                    {{ [match.job.company, match.job.city].filter(Boolean).join(' · ') }}
                  </p>
                  <p v-if="match.gaps.length" class="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    Wichtigste Lücke: {{ match.gaps[0].text }}
                  </p>
                </div>
                <div class="flex w-28 shrink-0 flex-col items-end gap-1.5">
                  <span class="text-lg leading-6 font-semibold">{{ match.score }}</span>
                  <div class="h-1.5 w-full rounded-full bg-muted">
                    <div
                      :class="[
                        'h-1.5 rounded-full',
                        match.score >= 70 ? 'bg-success' : match.score >= 40 ? 'bg-warning' : 'bg-destructive',
                      ]"
                      :style="{ width: `${match.score}%` }"
                    />
                  </div>
                  <span class="text-right text-xs text-muted-foreground">{{ match.fit }}</span>
                </div>
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Gauge } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useMatchesStore } from '../stores/matches'

const matches = useMatchesStore()
const error = ref<string | null>(null)
const loaded = ref(false)

onMounted(async () => {
  try {
    await matches.loadList()
    loaded.value = true
  } catch {
    error.value = 'Die Matches konnten nicht geladen werden.'
  }
})
</script>
