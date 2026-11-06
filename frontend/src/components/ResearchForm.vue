<template>
  <form class="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-xs" @submit.prevent="submit">
    <div class="flex items-center gap-2">
      <h2 class="flex-1 text-sm font-medium">Firma recherchieren</h2>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Formular schließen"
        title="Formular schließen"
        :disabled="running"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </div>
    <p class="text-xs text-muted-foreground">
      Die Recherche sucht im Web und braucht nichts über dich. Schreib nur Firma und Frage hinein.
    </p>
    <FormField
      v-model="company"
      label="Firma"
      placeholder="Firma, gern mit Ort oder Website"
      :maxlength="FIELD_MAX_CHARS"
    />
    <FormField
      v-model="question"
      label="Frage"
      placeholder="Was möchtest du über die Firma wissen?"
      :maxlength="FIELD_MAX_CHARS"
    />
    <p v-if="note" class="text-sm" role="alert">{{ note }}</p>
    <div class="flex justify-end">
      <button
        v-if="running"
        type="button"
        class="flex h-8 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
        @click="emit('stop')"
      >
        Anhalten
      </button>
      <button
        v-else
        type="submit"
        class="flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        :disabled="!company.trim() || !question.trim()"
      >
        Recherche starten
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue'
import { ref } from 'vue'
import type { ResearchInput } from '../types'
import FormField from './FormField.vue'

const FIELD_MAX_CHARS = 300

const props = defineProps<{ running: boolean; note: string | null }>()
const emit = defineEmits<{ submit: [input: ResearchInput]; stop: []; close: [] }>()

const company = ref('')
const question = ref('')

function submit() {
  if (props.running || !company.value.trim() || !question.value.trim()) return
  emit('submit', { company: company.value.trim(), question: question.value.trim() })
}
</script>
