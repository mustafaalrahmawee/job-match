<script setup lang="ts">
import { Upload } from '@lucide/vue';

defineProps<{ title: string; hint: string; uploading: boolean }>();
const emit = defineEmits<{ choose: [] }>();
</script>

<template>
  <button
    type="button"
    :disabled="uploading"
    class="hover:border-ring hover:bg-accent/50 flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-12 text-center transition-colors disabled:opacity-60"
    data-testid="upload-zone"
    @click="emit('choose')"
  >
    <div class="bg-secondary flex size-11 items-center justify-center rounded-lg">
      <Upload class="text-muted-foreground size-5" />
    </div>
    <div class="flex flex-col gap-1">
      <p class="text-sm font-medium">{{ uploading ? 'Wird hochgeladen …' : title }}</p>
      <p class="text-muted-foreground text-xs">{{ hint }}</p>
    </div>
  </button>
</template>
