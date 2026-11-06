<template>
  <div class="flex gap-3">
    <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
      <Search class="size-3.5" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-3 pt-0.5 text-sm">
      <p class="text-xs break-words text-muted-foreground">Recherche zu {{ research.company }}: {{ research.question }}</p>
      <StepList :steps="research.steps" />
      <p class="break-words whitespace-pre-line">{{ research.text }}</p>
      <div v-if="research.sources.length" class="text-xs text-muted-foreground">
        <p class="font-medium">Quellen</p>
        <ol class="mt-1 flex flex-col gap-0.5">
          <li v-for="source in research.sources" :key="source.url" class="truncate">
            <a :href="source.url" target="_blank" rel="noopener noreferrer" class="text-brand underline">
              {{ source.title || source.url }}
            </a>
          </li>
        </ol>
      </div>
      <p v-else class="text-xs text-muted-foreground">Ohne Quelle: Diese Antwort ist nicht belegt.</p>
      <div
        v-if="research.suspicious_text"
        class="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5"
        role="status"
      >
        <h3 class="text-sm font-medium">Auffälliger Text bei der Recherche</h3>
        <p class="text-xs text-muted-foreground">Prüfe die Antwort besonders genau, bevor du sie freigibst.</p>
        <p class="text-xs break-words whitespace-pre-line">{{ research.suspicious_text }}</p>
        <ul v-if="research.suspicious_sources.length" class="flex list-disc flex-col gap-1 pl-4 text-xs">
          <li v-for="source in research.suspicious_sources" :key="source.url" class="break-all">
            {{ source.title ? `${source.title} · ${source.url}` : source.url }}
          </li>
        </ul>
      </div>
      <section
        v-if="research.sources.length && !research.confirmed_at"
        class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <p class="flex-1 text-sm">Lies die Antwort. Der Coach nutzt sie erst, wenn du sie freigibst.</p>
        <button
          type="button"
          class="flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          :disabled="confirming"
          @click="confirm"
        >
          Für den Coach freigeben
        </button>
      </section>
      <p v-if="research.confirmed_at" class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check class="size-3.5 text-success" />
        Für den Coach freigegeben
      </p>
      <p
        v-if="confirmError"
        class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
        role="alert"
      >
        {{ confirmError }}
      </p>
      <CopyButton :text="research.text" class="-ml-1.5" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, Search } from '@lucide/vue'
import { ref } from 'vue'
import { ApiError } from '../api'
import { useResearchStore } from '../stores/research'
import type { Research } from '../types'
import CopyButton from './CopyButton.vue'
import StepList from './StepList.vue'

const props = defineProps<{ research: Research }>()

const store = useResearchStore()
const confirming = ref(false)
const confirmError = ref<string | null>(null)

async function confirm() {
  confirming.value = true
  confirmError.value = null
  try {
    await store.confirm(props.research)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) confirmError.value = 'Bitte melde dich neu an.'
    else if (e instanceof ApiError && e.status === 404) confirmError.value = 'Recherche nicht gefunden.'
    else if (e instanceof ApiError && e.status === 409) confirmError.value = 'Ohne Quelle lässt sich diese Antwort nicht freigeben.'
    else confirmError.value = 'Die Recherche konnte nicht freigegeben werden.'
  } finally {
    confirming.value = false
  }
}
</script>
