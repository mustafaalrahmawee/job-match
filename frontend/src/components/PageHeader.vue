<script setup lang="ts">
import { Menu } from '@lucide/vue';

import { Button } from '@/components/ui/button';
import { useLayoutStore } from '@/stores/layout';

defineProps<{ title: string }>();
const layout = useLayoutStore();
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
    <Button
      class="-ml-2 md:hidden"
      variant="ghost"
      size="icon"
      aria-label="Seitenleiste öffnen"
      @click="layout.sidebarOpen = true"
    >
      <Menu class="size-4" />
    </Button>
    <h1 class="min-w-0 flex-1 truncate text-sm font-medium" data-testid="page-title">
      {{ title }}
    </h1>
    <slot />
  </header>
</template>
