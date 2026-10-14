<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-background text-foreground shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    @cancel.prevent="emit('cancel')"
    @click.self="emit('cancel')"
  >
    <form class="flex flex-col gap-4 p-5" @submit.prevent="emit('confirm')">
      <h2 class="text-base font-semibold tracking-tight">{{ title }}</h2>
      <slot />
      <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          @click="emit('cancel')"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          :disabled="disabled"
          :class="[
            'h-9 rounded-md px-3 text-sm font-medium disabled:opacity-50',
            destructive
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          ]"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  confirmLabel: string
  destructive?: boolean
  disabled?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = useTemplateRef('dialog')

watch(
  () => props.open,
  (open) => {
    if (open) dialog.value?.showModal()
    else dialog.value?.close()
  },
)
</script>
