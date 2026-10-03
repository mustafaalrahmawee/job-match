<script setup lang="ts">
import {
  CircleAlert,
  Compass,
  FileText,
  LogOut,
  Menu,
  MessagesSquare,
  Plus,
  RotateCw,
  Sparkles,
  X,
} from '@lucide/vue';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppLogo from '@/components/AppLogo.vue';
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
  { icon: FileText, text: 'Wie schreibe ich ein überzeugendes Anschreiben?' },
  { icon: Compass, text: 'Wie gehe ich mit Lücken im Lebenslauf um?' },
  { icon: MessagesSquare, text: 'Wie bereite ich mich auf ein Vorstellungsgespräch vor?' },
];

const initial = computed(() => auth.user?.email.charAt(0).toUpperCase() ?? '?');

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
      class="fixed inset-0 z-20 bg-black/30 backdrop-blur-[2px] md:hidden"
      aria-hidden="true"
      @click="sidebarOpen = false"
    />
    <aside
      :class="[
        'bg-sidebar fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r transition-transform md:static md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center justify-between px-4 pt-4 pb-3">
        <AppLogo />
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
      <div class="px-3 pb-3">
        <Button class="w-full justify-start shadow-sm" data-testid="new-chat" @click="createNew">
          <Plus class="size-4" /> Neues Gespräch
        </Button>
      </div>
      <p class="text-muted-foreground px-5 pt-2 pb-1 text-xs font-medium tracking-wide uppercase">
        Gespräche
      </p>
      <div class="flex-1 overflow-y-auto px-2 pb-2">
        <ConversationList
          :conversations="chat.conversations"
          :active-id="chat.activeId"
          @select="select"
          @rename="(id, name) => chat.rename(id, name)"
          @remove="(id) => chat.remove(id)"
        />
      </div>
      <div class="flex items-center gap-3 border-t px-4 py-3 text-sm">
        <div
          class="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        >
          {{ initial }}
        </div>
        <span class="min-w-0 flex-1 truncate" data-testid="user-email">{{ auth.user?.email }}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abmelden"
          title="Abmelden"
          data-testid="logout"
          @click="logout"
        >
          <LogOut class="size-4" />
        </Button>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Button
          class="md:hidden"
          variant="ghost"
          size="icon"
          aria-label="Seitenleiste öffnen"
          @click="sidebarOpen = true"
        >
          <Menu class="size-4" />
        </Button>
        <h1 class="truncate font-medium" data-testid="chat-title">{{ title }}</h1>
      </header>

      <div ref="scroller" class="flex-1 overflow-y-auto" data-testid="messages">
        <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
          <div
            v-if="chat.messages.length === 0 && !chat.streaming"
            class="flex flex-col items-center gap-6 pt-10 text-center sm:pt-20"
            data-testid="empty-state"
          >
            <div
              class="bg-accent text-primary flex size-14 items-center justify-center rounded-2xl"
            >
              <Sparkles class="size-7" />
            </div>
            <div class="flex flex-col gap-2">
              <h2 class="text-2xl font-semibold tracking-tight">Womit kann ich dir helfen?</h2>
              <p class="text-muted-foreground max-w-md text-sm">
                Ich unterstütze dich bei Bewerbungsunterlagen, Stellensuche und
                Gesprächsvorbereitung.
              </p>
            </div>
            <div class="grid w-full gap-3 sm:grid-cols-3">
              <button
                v-for="suggestion in SUGGESTIONS"
                :key="suggestion.text"
                type="button"
                class="bg-card hover:border-primary/40 hover:bg-accent/50 flex flex-col items-start gap-3 rounded-xl border p-4 text-left text-sm shadow-xs transition-colors"
                @click="chat.send(suggestion.text)"
              >
                <component :is="suggestion.icon" class="text-primary size-5" />
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
          <MessageBubble
            v-if="chat.streaming"
            role="assistant"
            :text="chat.streamingText"
            streaming
          />
        </div>
      </div>

      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-2 pb-4">
        <div
          v-if="banner && !chat.streaming"
          class="bg-accent/60 text-accent-foreground flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm"
          role="alert"
          data-testid="banner"
        >
          <CircleAlert class="size-4 shrink-0" />
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
    </main>
  </div>
</template>
