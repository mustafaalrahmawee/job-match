<template>
  <button
    type="button"
    class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground"
    :aria-label="LABELS[state]"
    :title="LABELS[state]"
    @click="copy"
  >
    <Check v-if="state === 'copied'" class="size-3.5" />
    <X v-else-if="state === 'failed'" class="size-3.5 text-destructive" />
    <Copy v-else class="size-3.5" />
  </button>
</template>

<script setup lang="ts">
import { Check, Copy, X } from '@lucide/vue'
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ text: string }>()

const LABELS = { idle: 'Kopieren', copied: 'Kopiert', failed: 'Kopieren fehlgeschlagen' }

const state = ref<keyof typeof LABELS>('idle')
let timer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  try {
    await navigator.clipboard.writeText(props.text)
    state.value = 'copied'
  } catch {
    state.value = 'failed'
  }
  clearTimeout(timer)
  timer = setTimeout(() => (state.value = 'idle'), 2000)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>
