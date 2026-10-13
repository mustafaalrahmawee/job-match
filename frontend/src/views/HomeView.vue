<template>
  <PageHeader title="Start" />
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h2 class="text-2xl font-semibold tracking-tight">job-match</h2>
      <p class="text-sm text-muted-foreground">Angemeldet als {{ auth.user?.email }}</p>
      <div class="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <span class="flex-1 text-sm">Backend: {{ status }}</span>
        <button
          class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          @click="checkHealth"
        >
          Backend prüfen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { useAuthStore } from '../stores/auth'
import { useHealthStore } from '../stores/health'
import type { HealthStatus } from '../types'

const auth = useAuthStore()
const health = useHealthStore()
const status = ref<HealthStatus>('unknown')

async function checkHealth() {
  try {
    await health.check()
    status.value = 'ok'
  } catch {
    status.value = 'error'
  }
}
</script>
