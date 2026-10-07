<script setup lang="ts">
import type { Cv } from '@job-match/shared';
import { ListChecks, Trash2 } from '@lucide/vue';
import { computed, ref, watch } from 'vue';

import CvArchiveItem from '@/components/CvArchiveItem.vue';
import SectionHeading from '@/components/SectionHeading.vue';
import { Button } from '@/components/ui/button';

const props = defineProps<{ cvs: readonly Cv[] }>();
const emit = defineEmits<{ open: [id: string]; activate: [id: string]; remove: [ids: string[]] }>();

const selecting = ref(false);
const selectedIds = ref<string[]>([]);

const allSelected = computed(
  () => props.cvs.length > 0 && selectedIds.value.length === props.cvs.length,
);

watch(
  () => props.cvs,
  (cvs) => {
    selectedIds.value = selectedIds.value.filter((id) => cvs.some((cv) => cv.id === id));
    if (cvs.length === 0) selecting.value = false;
  },
);

function setSelected(id: string, selected: boolean): void {
  selectedIds.value = selected
    ? [...selectedIds.value, id]
    : selectedIds.value.filter((entry) => entry !== id);
}

function toggleAll(): void {
  selectedIds.value = allSelected.value ? [] : props.cvs.map((cv) => cv.id);
}

function stopSelecting(): void {
  selecting.value = false;
  selectedIds.value = [];
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <SectionHeading
      title="Frühere Fassungen"
      description="Werden nirgends benutzt, bis du eine wieder aktiv setzt."
      :count="cvs.length"
    >
      <Button
        v-if="!selecting && cvs.length > 1"
        variant="ghost"
        size="sm"
        class="text-muted-foreground"
        data-testid="start-selecting"
        @click="selecting = true"
      >
        <ListChecks class="size-3.5" /> Mehrere löschen
      </Button>
    </SectionHeading>

    <div
      v-if="selecting"
      class="bg-muted/60 flex flex-wrap items-center gap-3 rounded-lg px-4 py-2 text-sm"
    >
      <label class="flex flex-1 items-center gap-3">
        <input
          type="checkbox"
          class="accent-primary size-4"
          :checked="allSelected"
          data-testid="select-all-cvs"
          @change="toggleAll"
        />
        {{ selectedIds.length }} von {{ cvs.length }} ausgewählt
      </label>
      <Button variant="ghost" size="sm" @click="stopSelecting">Abbrechen</Button>
      <Button
        variant="destructive"
        size="sm"
        :disabled="selectedIds.length === 0"
        data-testid="delete-selected-cvs"
        @click="emit('remove', [...selectedIds])"
      >
        <Trash2 class="size-3.5" /> Löschen
      </Button>
    </div>

    <ul class="bg-card divide-y rounded-xl border shadow-xs">
      <CvArchiveItem
        v-for="cv in cvs"
        :key="cv.id"
        :cv="cv"
        :selectable="selecting"
        :selected="selectedIds.includes(cv.id)"
        @update:selected="(value) => setSelected(cv.id, value)"
        @open="emit('open', cv.id)"
        @activate="emit('activate', cv.id)"
        @remove="emit('remove', [cv.id])"
      />
    </ul>
  </section>
</template>
