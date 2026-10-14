<template>
  <form
    class="flex flex-col gap-1 rounded-2xl border border-input bg-card p-2 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
    @submit.prevent="submit"
  >
    <textarea
      ref="textarea"
      v-model="text"
      rows="1"
      maxlength="10000"
      placeholder="Nachricht an den Coach"
      aria-label="Nachricht an den Coach"
      class="max-h-40 min-h-9 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
      @input="resize"
      @keydown="onKeydown"
    />
    <div class="flex items-center gap-2">
      <ChatSettingsMenu v-model:quality="quality" v-model:effort="effort" />
      <span class="flex-1" />
      <button
        v-if="streaming"
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        aria-label="Antwort anhalten"
        title="Antwort anhalten"
        @click="emit('stop')"
      >
        <Square class="size-3.5 fill-current" />
      </button>
      <button
        v-else
        type="submit"
        :disabled="!text.trim()"
        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
        aria-label="Senden"
        title="Senden"
      >
        <ArrowUp class="size-4" />
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ArrowUp, Square } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'
import type { Effort, Quality } from '../types'
import ChatSettingsMenu from './ChatSettingsMenu.vue'

const props = defineProps<{ streaming: boolean }>()
const emit = defineEmits<{ send: [text: string]; stop: [] }>()
const quality = defineModel<Quality>('quality', { required: true })
const effort = defineModel<Effort>('effort', { required: true })

const text = ref('')
const textarea = useTemplateRef('textarea')

defineExpose({ focus: () => textarea.value?.focus() })

async function submit() {
  if (props.streaming || !text.value.trim()) return
  emit('send', text.value.trim())
  text.value = ''
  await nextTick()
  resize()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void submit()
  }
}

function resize() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}
</script>
