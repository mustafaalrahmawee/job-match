<script setup lang="ts">
import { BriefcaseBusiness } from '@lucide/vue';
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      class="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-sm"
    >
      <BriefcaseBusiness class="size-5" />
    </div>
    <div class="leading-tight">
      <p class="font-semibold tracking-tight">job-match</p>
      <p class="text-muted-foreground text-xs">Dein KI-Karriere-Coach</p>
    </div>
  </div>
</template>
