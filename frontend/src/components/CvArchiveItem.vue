<script setup lang="ts">
import { ROLE_LABELS } from '@job-match/shared';
import type { Cv } from '@job-match/shared';
import { Eye, RotateCcw, Trash2 } from '@lucide/vue';
import { computed } from 'vue';

import CvThumbnail from '@/components/CvThumbnail.vue';
import { Button } from '@/components/ui/button';
import { cvTitle, formatDate, formatSize } from '@/lib/format';

const props = defineProps<{ cv: Cv; selectable: boolean }>();
const selected = defineModel<boolean>('selected', { required: true });
const emit = defineEmits<{ open: []; activate: []; remove: [] }>();

const meta = computed(() =>
  [
    props.cv.fileName ? `Hochgeladen am ${formatDate(props.cv.createdAt)}` : null,
    props.cv.role ? ROLE_LABELS[props.cv.role] : 'ohne Rolle',
    formatSize(props.cv.sizeBytes),
  ]
    .filter(Boolean)
    .join(' · '),
);
</script>

<template>
  <li class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" data-testid="archived-cv">
    <input
      v-if="selectable"
      v-model="selected"
      type="checkbox"
      class="accent-primary size-4 shrink-0"
      :aria-label="`${cvTitle(cv)} auswählen`"
      data-testid="select-cv"
    />
    <CvThumbnail size="sm" class="hidden sm:flex" />
    <div class="min-w-0 flex-1 basis-48">
      <p class="truncate text-sm font-medium">{{ cvTitle(cv) }}</p>
      <p class="text-muted-foreground truncate text-xs">{{ meta }}</p>
    </div>
    <div v-if="!selectable" class="flex items-center gap-1">
      <Button variant="outline" size="sm" data-testid="activate-cv" @click="emit('activate')">
        <RotateCcw class="size-3.5" /> Aktiv setzen
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground"
        aria-label="PDF ansehen"
        title="Ansehen"
        @click="emit('open')"
      >
        <Eye class="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground hover:text-destructive"
        aria-label="Fassung löschen"
        title="Löschen"
        data-testid="delete-cv"
        @click="emit('remove')"
      >
        <Trash2 class="size-4" />
      </Button>
    </div>
  </li>
</template>
