<script setup lang="ts">
import { ROLE_LABELS, RoleSchema } from '@job-match/shared';
import type { Cv, Role } from '@job-match/shared';
import { Sparkles, TriangleAlert } from '@lucide/vue';
import { computed } from 'vue';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const props = defineProps<{ cv: Cv }>();
const emit = defineEmits<{ role: [id: string, role: Role] }>();

const suggestion = computed(() => props.cv.analysis?.suggestedRole ?? null);

const label = computed(() => {
  if (props.cv.role) return 'Deine Rolle';
  return suggestion.value ? 'Oder selbst wählen' : 'Wähle deine Rolle';
});

const hint = computed(() =>
  props.cv.role && suggestion.value && suggestion.value !== props.cv.role
    ? `Die KI hatte ${ROLE_LABELS[suggestion.value]} vorgeschlagen.`
    : 'Danach richten sich später Stellen, Matches und Empfehlungen.',
);

function selectRole(value: unknown): void {
  const parsed = RoleSchema.safeParse(value);
  if (parsed.success && parsed.data !== props.cv.role) emit('role', props.cv.id, parsed.data);
}
</script>

<template>
  <div
    :class="['flex flex-col gap-3 border-t px-5 py-4', cv.role ? 'bg-muted/40' : 'bg-warning/10']"
  >
    <div
      v-if="suggestion && !cv.role"
      class="bg-background flex flex-col gap-2 rounded-lg border p-3"
      data-testid="role-suggestion"
    >
      <p class="flex items-center gap-2 text-sm">
        <Sparkles class="text-brand size-4 shrink-0" />
        <span>
          Vorschlag der KI: <strong>{{ ROLE_LABELS[suggestion] }}</strong>
        </span>
      </p>
      <p class="text-muted-foreground text-xs leading-relaxed">
        {{ cv.analysis?.roleExplanation }}
      </p>
      <div>
        <Button size="sm" data-testid="role-accept" @click="emit('role', cv.id, suggestion)">
          Vorschlag übernehmen
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-start gap-2.5">
        <TriangleAlert v-if="!cv.role && !suggestion" class="text-warning mt-0.5 size-4 shrink-0" />
        <div class="flex flex-col gap-0.5">
          <label for="role-select" class="text-sm font-medium">{{ label }}</label>
          <p class="text-muted-foreground text-xs">{{ hint }}</p>
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
  </div>
</template>
