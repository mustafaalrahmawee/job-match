<script setup lang="ts">
import type { StoredStopReason } from '@job-match/shared';
import { Check, Copy } from '@lucide/vue';
import { computed, ref } from 'vue';

import { Button } from '@/components/ui/button';
import { renderMarkdown } from '@/lib/markdown';

const props = defineProps<{
  role: 'user' | 'assistant';
  text: string;
  stopReason?: StoredStopReason | null;
  streaming?: boolean;
}>();

const html = computed(() => (props.role === 'assistant' ? renderMarkdown(props.text) : ''));

const NOTICES: Partial<Record<StoredStopReason, string>> = {
  max_tokens: 'Die Antwort wurde gekürzt, weil das Längenlimit erreicht war.',
  context_window:
    'Die Antwort wurde gekürzt, weil das Gespräch das Limit des Modells erreicht hat.',
  aborted: 'Die Antwort wurde gestoppt.',
  error: 'Die Antwort wurde durch einen Fehler unterbrochen.',
};
const notice = computed(() => (props.stopReason ? NOTICES[props.stopReason] : undefined));

const copied = ref(false);
async function copy(): Promise<void> {
  await navigator.clipboard.writeText(props.text);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div :class="['flex', role === 'user' ? 'justify-end' : 'justify-start']" :data-role="role">
    <div
      :class="[
        'max-w-[85%] rounded-xl px-4 py-2.5 text-sm',
        role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
      ]"
    >
      <p v-if="role === 'user'" class="whitespace-pre-wrap" data-testid="message-text">
        {{ text }}
      </p>
      <p v-else-if="streaming && text === ''" class="text-muted-foreground" data-testid="thinking">
        Der Coach denkt nach …
      </p>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else class="markdown" data-testid="message-text" v-html="html" />

      <p v-if="notice" class="text-muted-foreground mt-2 text-xs" data-testid="message-notice">
        {{ notice }}
      </p>
      <div v-if="role === 'assistant' && !streaming" class="mt-1 -mb-1 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          class="size-7"
          aria-label="Antwort kopieren"
          data-testid="copy"
          @click="copy"
        >
          <Check v-if="copied" class="size-3.5" />
          <Copy v-else class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
