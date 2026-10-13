<template>
  <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
    <button
      type="button"
      :class="[
        '-ml-2 flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
        layout.pinned && 'md:hidden',
      ]"
      aria-label="Seitenleiste öffnen"
      title="Seitenleiste öffnen"
      @pointerenter="peekWithMouse"
      @click="layout.open()"
    >
      <PanelLeft class="size-4" />
    </button>
    <h1 class="min-w-0 flex-1 truncate text-sm font-medium">{{ title }}</h1>
    <slot />
  </header>
</template>

<script setup lang="ts">
import { PanelLeft } from '@lucide/vue'
import { useLayoutStore } from '../stores/layout'

defineProps<{ title: string }>()

const layout = useLayoutStore()

function peekWithMouse(event: PointerEvent) {
  if (event.pointerType === 'mouse') layout.peek()
}
</script>
