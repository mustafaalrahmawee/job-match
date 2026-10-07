<script setup lang="ts">
import { ROLE_LABELS, RoleSchema } from '@job-match/shared';
import type { Cv, Role } from '@job-match/shared';
import { Eye, Trash2, TriangleAlert } from '@lucide/vue';

import CvThumbnail from '@/components/CvThumbnail.vue';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cvTitle, formatDate, formatSize } from '@/lib/format';

const props = defineProps<{ cv: Cv }>();
const emit = defineEmits<{
  open: [id: string];
  remove: [ids: string[]];
  role: [id: string, role: Role];
}>();

function selectRole(value: unknown): void {
  const parsed = RoleSchema.safeParse(value);
  if (parsed.success && parsed.data !== props.cv.role) emit('role', props.cv.id, parsed.data);
}
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

    <div
      :class="[
        'flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center',
        cv.role ? 'bg-muted/40' : 'bg-warning/10',
      ]"
    >
      <div class="flex min-w-0 flex-1 items-start gap-2.5">
        <TriangleAlert v-if="!cv.role" class="text-warning mt-0.5 size-4 shrink-0" />
        <div class="flex flex-col gap-0.5">
          <label for="role-select" class="text-sm font-medium">
            {{ cv.role ? 'Deine Rolle' : 'Wähle deine Rolle' }}
          </label>
          <p class="text-muted-foreground text-xs">
            Danach richten sich später Stellen, Matches und Empfehlungen.
          </p>
        </div>
      </div>
      <Select :model-value="cv.role ?? undefined" @update:model-value="selectRole">
        <SelectTrigger
          id="role-select"
          class="bg-background w-full sm:w-64"
          data-testid="role-select"
        >
          <SelectValue placeholder="Rolle wählen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="role in RoleSchema.options" :key="role" :value="role">
            {{ ROLE_LABELS[role] }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </section>
</template>
