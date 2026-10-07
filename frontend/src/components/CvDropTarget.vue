<script setup lang="ts">
import { Upload } from '@lucide/vue';
import { ref } from 'vue';

const emit = defineEmits<{ file: [file: File] }>();
const dragging = ref(false);

function onDrop(event: DragEvent): void {
  dragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) emit('file', file);
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col" @dragenter.prevent="dragging = true">
    <slot />
    <div
      v-if="dragging"
      class="bg-background/85 absolute inset-0 z-10 flex items-center justify-center p-6 backdrop-blur-sm"
      data-testid="drop-overlay"
      @dragover.prevent
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div
        class="border-brand text-brand pointer-events-none flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed"
      >
        <Upload class="size-8" />
        <p class="text-sm font-medium">PDF hier loslassen, um es als neue Fassung hochzuladen</p>
      </div>
    </div>
  </div>
</template>
