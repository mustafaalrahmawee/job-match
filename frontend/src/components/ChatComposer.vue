<script setup lang="ts">
import { EffortSchema, MAX_MESSAGE_LENGTH, ModelChoiceSchema } from '@job-match/shared';
import { Send, Square } from '@lucide/vue';
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
  <form class="flex flex-col gap-2" @submit.prevent="submit">
    <div class="flex items-end gap-2">
      <Textarea
        v-model="text"
        class="max-h-48 min-h-11 resize-none"
        placeholder="Schreibe dem Coach …"
        aria-label="Nachricht an den Coach"
        :maxlength="MAX_MESSAGE_LENGTH"
        data-testid="composer-input"
        @keydown.enter.exact="onEnter"
      />
      <Button
        v-if="chat.streaming"
        type="button"
        variant="outline"
        size="icon"
        aria-label="Antwort stoppen"
        data-testid="stop"
        @click="chat.stop"
      >
        <Square class="size-4" />
      </Button>
      <Button
        v-else
        type="submit"
        size="icon"
        aria-label="Nachricht senden"
        :disabled="text.trim() === ''"
        data-testid="send"
      >
        <Send class="size-4" />
      </Button>
    </div>
    <div class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <div class="flex items-center gap-2">
        <Label for="model-select" class="text-xs font-normal">Qualität</Label>
        <Select :model-value="chat.model" @update:model-value="selectModel">
          <SelectTrigger id="model-select" size="sm" class="w-32" data-testid="model-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Normal</SelectItem>
            <SelectItem value="advanced">Erweitert</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex items-center gap-2">
        <Label for="effort-select" class="text-xs font-normal">Gründlichkeit</Label>
        <Select :model-value="chat.effort" @update:model-value="selectEffort">
          <SelectTrigger id="effort-select" size="sm" class="w-28" data-testid="effort-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Niedrig</SelectItem>
            <SelectItem value="high">Hoch</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  </form>
</template>
