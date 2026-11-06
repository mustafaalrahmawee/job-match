<template>
  <ul v-if="steps.length" class="flex flex-col gap-1.5">
    <li
      v-for="(step, index) in steps"
      :key="index"
      class="flex items-center gap-2 rounded-md border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground"
    >
      <CircleAlert
        v-if="step.kind === 'application_failed' || (step.kind === 'web_search' && step.sources === null)"
        class="size-3.5 shrink-0"
      />
      <Check v-else class="size-3.5 shrink-0 text-success" />
      <span v-if="step.kind === 'application'" class="min-w-0 truncate">
        Bewerbung gelesen: {{ step.title }}{{ step.company ? ` · ${step.company}` : '' }}
      </span>
      <span v-else-if="step.kind === 'application_failed'">Bewerbung konnte nicht gelesen werden</span>
      <span v-else class="min-w-0 truncate">
        Websuche: „{{ step.query }}“ ·
        {{
          step.sources === null
            ? 'fehlgeschlagen'
            : `${step.sources} ${step.sources === 1 ? 'Quelle' : 'Quellen'} gelesen`
        }}
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { Check, CircleAlert } from '@lucide/vue'
import type { CoachStep } from '../types'

defineProps<{ steps: CoachStep[] }>()
</script>
