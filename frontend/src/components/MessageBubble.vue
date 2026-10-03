<script setup lang="ts">
import type { StoredStopReason } from '@job-match/shared';
import { Check, Copy, Sparkles } from '@lucide/vue';
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
  <div v-if="role === 'user'" class="flex justify-end" data-role="user">
    <p
      class="bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap shadow-xs"
      data-testid="message-text"
    >
      {{ text }}
    </p>
  </div>

  <div v-else class="flex gap-3" data-role="assistant">
    <div
      class="bg-accent text-primary flex size-8 shrink-0 items-center justify-center rounded-full"
    >
      <Sparkles class="size-4" />
    </div>
    <div class="min-w-0 flex-1 pt-1 text-sm">
      <p
        v-if="streaming && text === ''"
        class="text-muted-foreground animate-pulse"
        data-testid="thinking"
      >
        Der Coach denkt nach …
      </p>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else class="markdown" data-testid="message-text" v-html="html" />

      <p
        v-if="notice"
        class="text-muted-foreground mt-3 border-l-2 pl-3 text-xs"
        data-testid="message-notice"
      >
        {{ notice }}
      </p>
      <Button
        v-if="!streaming"
        variant="ghost"
        size="xs"
        class="text-muted-foreground mt-2 -ml-2"
        data-testid="copy"
        @click="copy"
      >
        <Check v-if="copied" /> <Copy v-else />
        {{ copied ? 'Kopiert' : 'Kopieren' }}
      </Button>
    </div>
  </div>
</template>
