<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-start gap-4">
      <slot />
      <div v-if="score !== null" class="shrink-0 text-right">
        <span class="block text-xs font-medium text-muted-foreground">Match</span>
        <span class="block text-[40px] leading-11 font-semibold tracking-tight">{{ score }}</span>
      </div>
    </div>
    <div v-if="score !== null" class="h-1.5 rounded-full bg-muted">
      <div :class="['h-1.5 rounded-full', color]" :style="{ width: `${score}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ score: number | null }>()

const color = computed(() => {
  const score = props.score ?? 0
  return score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-destructive'
})
</script>
