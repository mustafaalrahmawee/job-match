import {
  ConversationDetailSchema,
  ConversationListSchema,
  ConversationSchema,
} from '@job-match/shared';
import type {
  ChatRequest,
  Conversation,
  Effort,
  Message,
  ModelChoice,
  StoredStopReason,
} from '@job-match/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { ApiError, apiJson, apiVoid } from '@/lib/api';
import { streamChat } from '@/lib/chat-stream';

export interface DisplayMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly text: string;
  readonly stopReason: StoredStopReason | null;
}

const CONNECTION_LOST = 'Die Verbindung wurde unterbrochen.';

function toDisplay(message: Message): DisplayMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.content.map((block) => block.text).join(''),
    stopReason: message.stopReason,
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([]);
  const activeId = ref<string | null>(null);
  const messages = ref<DisplayMessage[]>([]);

  const streaming = ref(false);
  const streamingText = ref('');
  const refused = ref(false);
  const error = ref<string | null>(null);

  const model = ref<ModelChoice>('standard');
  const effort = ref<Effort>('low');

  let controller: AbortController | undefined;

  const canRetry = computed(
    () => !streaming.value && activeId.value !== null && messages.value.at(-1)?.role === 'user',
  );

  async function loadConversations(): Promise<void> {
    conversations.value = await apiJson('GET', '/api/conversations', ConversationListSchema);
  }

  function clearTransient(): void {
    streamingText.value = '';
    refused.value = false;
    error.value = null;
  }

  async function open(id: string): Promise<boolean> {
    stop();
    clearTransient();
    try {
      const detail = await apiJson('GET', `/api/conversations/${id}`, ConversationDetailSchema);
      activeId.value = detail.id;
      messages.value = detail.messages.map(toDisplay);
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) return false;
      throw cause;
    }
  }

  function newConversation(): void {
    stop();
    clearTransient();
    activeId.value = null;
    messages.value = [];
  }

  async function syncActive(): Promise<void> {
    const id = activeId.value;
    if (id === null) return;
    const detail = await apiJson('GET', `/api/conversations/${id}`, ConversationDetailSchema);
    messages.value = detail.messages.map(toDisplay);
  }

  async function run(request: ChatRequest): Promise<void> {
    streaming.value = true;
    clearTransient();
    const abort = new AbortController();
    controller = abort;
    let finished = false;

    try {
      for await (const event of streamChat(request, abort.signal)) {
        switch (event.type) {
          case 'conversation':
            activeId.value ??= event.id;
            break;
          case 'delta':
            streamingText.value += event.text;
            break;
          case 'done':
            finished = true;
            break;
          case 'refusal':
            finished = true;
            refused.value = true;
            break;
          case 'error':
            finished = true;
            error.value = event.message;
            break;
        }
      }
      if (!finished) error.value = CONNECTION_LOST;
    } catch (cause) {
      if (!isAbort(cause))
        error.value = cause instanceof ApiError ? cause.message : CONNECTION_LOST;
    } finally {
      await syncActive().catch(() => undefined);
      streaming.value = false;
      streamingText.value = '';
      controller = undefined;
      await loadConversations().catch(() => undefined);
    }
  }

  async function send(text: string): Promise<void> {
    const message = text.trim();
    if (message === '' || streaming.value) return;

    messages.value.push({
      id: `local-${Date.now()}`,
      role: 'user',
      text: message,
      stopReason: null,
    });
    await run({
      conversationId: activeId.value ?? undefined,
      message,
      model: model.value,
      effort: effort.value,
    });
  }

  async function retry(): Promise<void> {
    if (!canRetry.value || activeId.value === null) return;
    await run({ conversationId: activeId.value, model: model.value, effort: effort.value });
  }

  function stop(): void {
    controller?.abort();
  }

  async function rename(id: string, title: string): Promise<void> {
    const updated = await apiJson('PATCH', `/api/conversations/${id}`, ConversationSchema, {
      title,
    });
    conversations.value = conversations.value.map((entry) => (entry.id === id ? updated : entry));
  }

  async function remove(id: string): Promise<void> {
    await apiVoid('DELETE', `/api/conversations/${id}`);
    conversations.value = conversations.value.filter((entry) => entry.id !== id);
    if (activeId.value === id) newConversation();
  }

  function reset(): void {
    newConversation();
    conversations.value = [];
  }

  return {
    conversations,
    activeId,
    messages,
    streaming,
    streamingText,
    refused,
    error,
    model,
    effort,
    canRetry,
    loadConversations,
    open,
    newConversation,
    send,
    retry,
    stop,
    rename,
    remove,
    reset,
  };
});
