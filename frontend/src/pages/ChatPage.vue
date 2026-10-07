<script setup lang="ts">
import { CircleAlert, Compass, FileText, MessagesSquare, RotateCw } from '@lucide/vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ChatComposer from '@/components/ChatComposer.vue';
import MessageBubble from '@/components/MessageBubble.vue';
import PageHeader from '@/components/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chat';

const chat = useChatStore();
const route = useRoute();
const router = useRouter();

const scroller = ref<HTMLElement | null>(null);

const SUGGESTIONS = [
  { icon: FileText, text: 'Wie schreibe ich ein überzeugendes Anschreiben?' },
  { icon: Compass, text: 'Wie gehe ich mit Lücken im Lebenslauf um?' },
  { icon: MessagesSquare, text: 'Wie bereite ich mich auf ein Vorstellungsgespräch vor?' },
];

const routeId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));
const title = computed(
  () => chat.conversations.find((entry) => entry.id === chat.activeId)?.title ?? 'Neues Gespräch',
);

watch(
  routeId,
  async (id) => {
    if (id === null) {
      if (chat.activeId !== null) chat.newConversation();
    } else if (id !== chat.activeId && !(await chat.open(id))) {
      await router.replace({ name: 'chat' });
    }
  },
  { immediate: true },
);

watch(
  () => chat.activeId,
  (id) => {
    if (id !== routeId.value) {
      void router.replace(id ? { name: 'chat', params: { id } } : { name: 'chat' });
    }
  },
);

watch(
  [() => chat.messages.length, () => chat.streamingText],
  async () => {
    const element = scroller.value;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 160;
    await nextTick();
    if (nearBottom) element.scrollTop = element.scrollHeight;
  },
  { flush: 'pre' },
);

const banner = computed(() => {
  if (chat.error) return chat.error;
  if (chat.refused) {
    return 'Auf diese Anfrage kann der Coach nicht antworten. Formuliere sie anders oder stelle eine neue Frage.';
  }
  if (chat.canRetry) return 'Auf deine letzte Nachricht gibt es noch keine Antwort.';
  return null;
});
</script>

<template>
  <PageHeader :title="title" />

  <div ref="scroller" class="flex-1 overflow-y-auto" data-testid="messages">
    <div class="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <div
        v-if="chat.messages.length === 0 && !chat.streaming"
        class="flex flex-col gap-8 pt-8 sm:pt-24"
        data-testid="empty-state"
      >
        <div class="flex flex-col gap-2">
          <h2 class="text-2xl font-semibold tracking-tight">Womit kann ich dir helfen?</h2>
          <p class="text-muted-foreground text-sm">
            Frag deinen Coach zu Bewerbungsunterlagen, Stellensuche und Vorstellungsgesprächen.
          </p>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <button
            v-for="suggestion in SUGGESTIONS"
            :key="suggestion.text"
            type="button"
            class="hover:bg-accent flex flex-col items-start gap-3 rounded-lg border p-4 text-left text-sm transition-colors"
            @click="chat.send(suggestion.text)"
          >
            <component :is="suggestion.icon" class="text-muted-foreground size-4" />
            {{ suggestion.text }}
          </button>
        </div>
      </div>

      <MessageBubble
        v-for="message in chat.messages"
        :key="message.id"
        :role="message.role"
        :text="message.text"
        :stop-reason="message.stopReason"
      />
      <MessageBubble v-if="chat.streaming" role="assistant" :text="chat.streamingText" streaming />
    </div>
  </div>

  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-2 pb-4">
    <div
      v-if="banner && !chat.streaming"
      class="bg-muted flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
      role="alert"
      data-testid="banner"
    >
      <CircleAlert class="text-muted-foreground size-4 shrink-0" />
      <span class="flex-1">{{ banner }}</span>
      <Button
        v-if="chat.canRetry"
        variant="outline"
        size="sm"
        data-testid="retry"
        @click="chat.retry"
      >
        <RotateCw class="size-3.5" /> Erneut versuchen
      </Button>
    </div>
    <ChatComposer />
  </div>
</template>
