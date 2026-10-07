<script setup lang="ts">
defineProps<{ size?: 'sm' | 'md' }>();
</script>

<template>
  <div
    :class="[
      'bg-card flex shrink-0 flex-col gap-1 rounded-md border shadow-xs',
      size === 'sm' ? 'h-10 w-8 p-1.5' : 'h-[74px] w-14 p-2.5',
    ]"
    aria-hidden="true"
  >
    <div class="bg-foreground/70 h-1 w-2/3 rounded-full" />
    <div class="bg-muted-foreground/25 h-0.5 w-full rounded-full" />
    <div class="bg-muted-foreground/25 h-0.5 w-5/6 rounded-full" />
    <div v-if="size !== 'sm'" class="bg-muted-foreground/25 h-0.5 w-full rounded-full" />
    <div v-if="size !== 'sm'" class="bg-muted-foreground/25 h-0.5 w-3/4 rounded-full" />
    <span
      v-if="size !== 'sm'"
      class="text-destructive mt-auto text-[8px] leading-none font-semibold tracking-wide"
    >
      PDF
    </span>
  </div>
</template>
