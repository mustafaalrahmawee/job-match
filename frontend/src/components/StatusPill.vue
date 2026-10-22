<template>
  <span :class="['inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', COLORS[status]]">
    {{ APPLICATION_STATUS_LABELS[status] }}
  </span>
</template>

<script setup lang="ts">
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '../types'

defineProps<{ status: ApplicationStatus }>()

const COLORS: Record<ApplicationStatus, string> = {
  saved: 'bg-secondary text-foreground',
  applied: 'bg-accent text-foreground',
  interview: 'bg-warning/20 text-foreground',
  offer: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-secondary text-muted-foreground',
}
</script>
