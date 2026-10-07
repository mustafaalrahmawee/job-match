<script setup lang="ts">
import { EffortSchema, MAX_MESSAGE_LENGTH, ModelChoiceSchema } from '@job-match/shared';
import { ArrowUp, Square } from '@lucide/vue';
import { ref } from 'vue';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useChatStore } from '@/stores/chat';

const chat = useChatStore();
const text = ref('');

function submit(): void {
  const message = text.value.trim();
  if (message === '' || chat.streaming) return;
  text.value = '';
  void chat.send(message);
}

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing) return;
  event.preventDefault();
  submit();
}

function selectModel(value: unknown): void {
  const parsed = ModelChoiceSchema.safeParse(value);
  if (parsed.success) chat.model = parsed.data;
}

function selectEffort(value: unknown): void {
  const parsed = EffortSchema.safeParse(value);
  if (parsed.success) chat.effort = parsed.data;
}
</script>

<template>
  <form
    class="bg-card focus-within:border-ring flex flex-col rounded-xl border shadow-xs transition-colors"
    @submit.prevent="submit"
  >
    <Textarea
      v-model="text"
      class="max-h-48 min-h-14 resize-none border-0 bg-transparent px-4 pt-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
      placeholder="Schreibe dem Coach …"
      aria-label="Nachricht an den Coach"
      :maxlength="MAX_MESSAGE_LENGTH"
      data-testid="composer-input"
      @keydown.enter.exact="onEnter"
    />
    <div class="flex items-end gap-1 px-2 pb-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <Label for="model-select" class="sr-only">Qualität</Label>
        <Select :model-value="chat.model" @update:model-value="selectModel">
          <SelectTrigger
            id="model-select"
            size="sm"
            class="text-muted-foreground hover:bg-muted border-0 bg-transparent text-xs shadow-none dark:bg-transparent"
            data-testid="model-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Qualität: Normal</SelectItem>
            <SelectItem value="advanced">Qualität: Erweitert</SelectItem>
          </SelectContent>
        </Select>
        <Label for="effort-select" class="sr-only">Gründlichkeit</Label>
        <Select :model-value="chat.effort" @update:model-value="selectEffort">
          <SelectTrigger
            id="effort-select"
            size="sm"
            class="text-muted-foreground hover:bg-muted border-0 bg-transparent text-xs shadow-none dark:bg-transparent"
            data-testid="effort-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Gründlichkeit: Niedrig</SelectItem>
            <SelectItem value="high">Gründlichkeit: Hoch</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        v-if="chat.streaming"
        type="button"
        variant="outline"
        size="icon"
        class="shrink-0 rounded-full"
        aria-label="Antwort stoppen"
        data-testid="stop"
        @click="chat.stop"
      >
        <Square class="size-3.5 fill-current" />
      </Button>
      <Button
        v-else
        type="submit"
        size="icon"
        class="shrink-0 rounded-full"
        aria-label="Nachricht senden"
        :disabled="text.trim() === ''"
        data-testid="send"
      >
        <ArrowUp class="size-4" />
      </Button>
    </div>
  </form>
  <p class="text-muted-foreground text-center text-xs">
    <span class="hidden sm:inline">Enter sendet, Umschalt + Enter macht eine neue Zeile. </span>Der
    Coach kann sich irren.
  </p>
</template>
