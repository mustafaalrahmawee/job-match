<script setup lang="ts">
import { CircleAlert } from '@lucide/vue'
import AppLogo from './AppLogo.vue'

defineProps<{ title: string; description: string; error?: string | null }>()
</script>

<template>
  <main class="flex min-h-svh items-center justify-center bg-sidebar p-4">
    <div class="flex w-full max-w-sm flex-col items-center gap-8">
      <AppLogo />
      <div class="w-full rounded-xl border bg-card p-6 shadow-sm">
        <h1 class="text-xl font-semibold">{{ title }}</h1>
        <p class="mt-1.5 mb-6 text-sm text-muted-foreground">{{ description }}</p>
        <div
          v-if="error"
          role="alert"
          class="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <CircleAlert class="mt-0.5 size-4 shrink-0" />
          <span>{{ error }}</span>
        </div>
        <slot />
      </div>
      <p v-if="$slots.footer" class="text-sm text-muted-foreground">
        <slot name="footer" />
      </p>
    </div>
  </main>
</template>
