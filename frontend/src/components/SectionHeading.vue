<script setup lang="ts">
defineProps<{ title: string; description: string; count?: number }>();
</script>

<template>
  <div class="flex min-h-9 flex-wrap items-end gap-3">
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <h3 class="text-sm font-semibold">
        {{ title }}
        <span v-if="count !== undefined" class="text-muted-foreground font-normal">
          ({{ count }})
        </span>
      </h3>
      <p class="text-muted-foreground text-xs">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
