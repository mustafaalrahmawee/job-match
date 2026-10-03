<script setup lang="ts">
import { LogOut, Menu, Plus, RotateCw, X } from '@lucide/vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ChatComposer from '@/components/ChatComposer.vue';
import ConversationList from '@/components/ConversationList.vue';
import MessageBubble from '@/components/MessageBubble.vue';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';

const auth = useAuthStore();
const chat = useChatStore();
const route = useRoute();
const router = useRouter();

const sidebarOpen = ref(false);
const scroller = ref<HTMLElement | null>(null);

const SUGGESTIONS = [
  'Wie schreibe ich ein überzeugendes Anschreiben?',
  'Wie gehe ich mit Lücken im Lebenslauf um?',
  'Wie bereite ich mich auf ein Vorstellungsgespräch vor?',
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

onMounted(() => chat.loadConversations().catch(() => undefined));

function select(id: string): void {
  sidebarOpen.value = false;
  void router.push({ name: 'chat', params: { id } });
}

function createNew(): void {
  sidebarOpen.value = false;
  void router.push({ name: 'chat' });
}

async function logout(): Promise<void> {
  await auth.logout();
  chat.reset();
  await router.replace({ name: 'login' });
}

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
  <div class="flex h-svh">
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-20 bg-black/40 md:hidden"
      aria-hidden="true"
      @click="sidebarOpen = false"
    />
    <aside
      :class="[
        'bg-background fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r transition-transform md:static md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center gap-2 p-3">
        <Button
          class="flex-1 justify-start"
          variant="outline"
          data-testid="new-chat"
          @click="createNew"
        >
          <Plus class="size-4" /> Neues Gespräch
        </Button>
        <Button
          class="md:hidden"
          variant="ghost"
          size="icon"
          aria-label="Seitenleiste schließen"
          @click="sidebarOpen = false"
        >
          <X class="size-4" />
        </Button>
      </div>
      <div class="flex-1 overflow-y-auto px-2">
        <ConversationList
          :conversations="chat.conversations"
          :active-id="chat.activeId"
          @select="select"
          @rename="(id, name) => chat.rename(id, name)"
          @remove="(id) => chat.remove(id)"
        />
      </div>
      <div class="flex items-center justify-between gap-2 border-t p-3 text-sm">
        <span class="text-muted-foreground min-w-0 truncate" data-testid="user-email">
          {{ auth.user?.email }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abmelden"
          data-testid="logout"
          @click="logout"
        >
          <LogOut class="size-4" />
        </Button>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center gap-2 border-b px-4 py-2">
        <Button
          class="md:hidden"
          variant="ghost"
          size="icon"
          aria-label="Seitenleiste öffnen"
          @click="sidebarOpen = true"
        >
          <Menu class="size-4" />
        </Button>
        <h1 class="truncate text-sm font-medium" data-testid="chat-title">{{ title }}</h1>
      </header>

      <div ref="scroller" class="flex-1 overflow-y-auto" data-testid="messages">
        <div class="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          <div
            v-if="chat.messages.length === 0 && !chat.streaming"
            class="flex flex-col items-center gap-4 py-16 text-center"
            data-testid="empty-state"
          >
            <h2 class="text-xl font-semibold">Womit kann ich dir helfen?</h2>
            <p class="text-muted-foreground text-sm">
              Ich unterstütze dich bei Bewerbungsunterlagen, Stellensuche und Gesprächsvorbereitung.
            </p>
            <div class="flex flex-col gap-2">
              <Button
                v-for="suggestion in SUGGESTIONS"
                :key="suggestion"
                variant="outline"
                size="sm"
                @click="chat.send(suggestion)"
              >
                {{ suggestion }}
              </Button>
            </div>
          </div>

          <MessageBubble
            v-for="message in chat.messages"
            :key="message.id"
            :role="message.role"
            :text="message.text"
            :stop-reason="message.stopReason"
          />
          <MessageBubble
            v-if="chat.streaming"
            role="assistant"
            :text="chat.streamingText"
            streaming
          />
        </div>
      </div>

      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4 pt-2">
        <div
          v-if="banner && !chat.streaming"
          class="bg-muted flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm"
          role="alert"
          data-testid="banner"
        >
          <span>{{ banner }}</span>
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
    </main>
  </div>
</template>
