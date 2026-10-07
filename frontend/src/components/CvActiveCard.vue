<script setup lang="ts">
import { ROLE_LABELS } from '@job-match/shared';
import type { Cv, Role } from '@job-match/shared';
import { Eye, Trash2 } from '@lucide/vue';

import CvAnalysisState from '@/components/CvAnalysisState.vue';
import CvRolePicker from '@/components/CvRolePicker.vue';
import CvThumbnail from '@/components/CvThumbnail.vue';
import { Button } from '@/components/ui/button';
import { cvTitle, formatDate, formatSize } from '@/lib/format';

defineProps<{ cv: Cv }>();
const emit = defineEmits<{
  open: [id: string];
  remove: [ids: string[]];
  role: [id: string, role: Role];
  analyze: [id: string];
}>();
</script>

<template>
  <section class="bg-card overflow-hidden rounded-xl border shadow-xs" data-testid="active-cv">
    <div class="flex items-start gap-4 p-5">
      <CvThumbnail class="hidden sm:flex" />
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <p class="truncate font-medium" data-testid="cv-title">{{ cvTitle(cv) }}</p>
        <div class="flex flex-wrap items-center gap-1.5">
          <span
            class="text-success bg-success/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
          >
            <span class="bg-success size-1.5 rounded-full" /> Aktiv
          </span>
          <span
            v-if="cv.role"
            class="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium"
          >
            {{ ROLE_LABELS[cv.role] }}
          </span>
        </div>
        <p class="text-muted-foreground text-xs">
          Hochgeladen am {{ formatDate(cv.createdAt) }} · {{ formatSize(cv.sizeBytes) }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" @click="emit('open', cv.id)">
          <Eye class="size-3.5" /> <span class="hidden sm:inline">Ansehen</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-muted-foreground hover:text-destructive"
          aria-label="Aktive Fassung löschen"
          title="Löschen"
          data-testid="delete-active-cv"
          @click="emit('remove', [cv.id])"
        >
          <Trash2 class="size-4" />
        </Button>
      </div>
    </div>

    <CvAnalysisState :cv="cv" @analyze="(id) => emit('analyze', id)" />
    <CvRolePicker :cv="cv" @role="(id, role) => emit('role', id, role)" />
  </section>
</template>
