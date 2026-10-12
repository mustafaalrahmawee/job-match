<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue'
import { useAuthStore } from '../stores/auth'
import { useHealthStore } from '../stores/health'

const auth = useAuthStore()
const health = useHealthStore()
</script>

<template>
  <PageHeader title="Start" />
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h2 class="text-2xl font-semibold tracking-tight">job-match</h2>
      <p class="text-sm text-muted-foreground">Angemeldet als {{ auth.user?.email }}</p>
      <div class="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span class="flex-1 text-sm">Backend: {{ health.status }}</span>
        <button
          class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          @click="health.check()"
        >
          Backend prüfen
        </button>
      </div>
    </div>
  </div>
</template>
