<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      :class="open && 'bg-accent text-foreground'"
      aria-haspopup="menu"
      :aria-expanded="open"
      title="Qualität und Aufwand"
      @click="open = !open"
    >
      {{ QUALITIES.find((o) => o.value === quality)?.label }} · {{ EFFORTS.find((o) => o.value === effort)?.label }}
      <ChevronDown class="size-3.5 transition-transform" :class="open && 'rotate-180'" />
    </button>

    <div
      v-if="open"
      role="menu"
      class="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <p class="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Qualität</p>
      <button
        v-for="option in QUALITIES"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="quality === option.value"
        class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
        @click="quality = option.value"
      >
        <Check class="mt-0.5 size-4 shrink-0" :class="quality !== option.value && 'invisible'" />
        <span class="flex flex-col">
          {{ option.label }}
          <span class="text-xs text-muted-foreground">{{ option.hint }}</span>
        </span>
      </button>

      <div class="mx-2 my-1 border-t" />

      <p class="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Aufwand</p>
      <button
        v-for="option in EFFORTS"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="effort === option.value"
        class="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
        @click="effort = option.value"
      >
        <Check class="mt-0.5 size-4 shrink-0" :class="effort !== option.value && 'invisible'" />
        <span class="flex flex-col">
          {{ option.label }}
          <span class="text-xs text-muted-foreground">{{ option.hint }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import type { Effort, Quality } from '../types'

const quality = defineModel<Quality>('quality', { required: true })
const effort = defineModel<Effort>('effort', { required: true })

const QUALITIES = [
  { value: 'normal', label: 'Normal', hint: 'Antwortet sofort' },
  { value: 'extended', label: 'Erweitert', hint: 'Denkt vor der Antwort nach, dauert länger' },
] as const

const EFFORTS = [
  { value: 'medium', label: 'Mittel', hint: 'Schneller, reicht für die meisten Fragen' },
  { value: 'high', label: 'Hoch', hint: 'Gründlicher, dauert länger' },
] as const

const open = ref(false)
const root = useTemplateRef('root')

function closeOutside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOutside)
  document.addEventListener('keydown', closeOnEscape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOutside)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>
