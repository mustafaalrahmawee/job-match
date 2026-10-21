<template>
  <RouterLink
    :to="job.source === 'own' ? `/jobs/own/${job.id}` : `/jobs/${job.id}`"
    class="flex gap-4 px-4 py-3.5 hover:bg-accent"
  >
    <div class="min-w-0 flex-1">
      <p class="line-clamp-2 text-sm font-medium">{{ job.title }}</p>
      <p v-if="job.company" class="mt-0.5 truncate text-sm text-muted-foreground">{{ job.company }}</p>
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
          <MapPin class="size-3.5" />
          {{ job.city }}
        </span>
        <span v-if="time" class="inline-flex items-center gap-1.5">
          <Clock class="size-3.5" />
          {{ time }}
        </span>
        <span v-if="OFFER_LABELS[job.offer_type]" class="inline-flex items-center gap-1.5">
          <Tag class="size-3.5" />
          {{ OFFER_LABELS[job.offer_type] }}
        </span>
      </div>
    </div>
    <span class="shrink-0 text-xs text-muted-foreground">{{ age }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { Clock, MapPin, Tag } from '@lucide/vue'
import { computed } from 'vue'
import { OFFER_LABELS, type Job } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

const props = defineProps<{ job: Job }>()

const time = computed(() =>
  props.job.full_time ? (props.job.part_time ? 'Vollzeit, Teilzeit möglich' : 'Vollzeit') : props.job.part_time ? 'Teilzeit' : null,
)

const age = computed(() => {
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.max(0, Math.round((today - Date.parse(props.job.published_at)) / DAY_MS))
  return days === 0 ? 'heute' : days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`
})
</script>
