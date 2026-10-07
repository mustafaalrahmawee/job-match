<script setup lang="ts">
import { FileUser, LogOut, MessagesSquare, SquarePen, X } from '@lucide/vue';
import { computed, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import AppLogo from '@/components/AppLogo.vue';
import ConversationList from '@/components/ConversationList.vue';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useLayoutStore } from '@/stores/layout';
import { useProfileStore } from '@/stores/profile';

const auth = useAuthStore();
const chat = useChatStore();
const profile = useProfileStore();
const layout = useLayoutStore();
const route = useRoute();
const router = useRouter();

const NAV = [
  { name: 'chat', label: 'Coach', icon: MessagesSquare },
  { name: 'profile', label: 'Mein Lebenslauf', icon: FileUser },
] as const;

const initial = computed(() => auth.user?.email.charAt(0).toUpperCase() ?? '?');

onMounted(() => chat.loadConversations().catch(() => undefined));

watch(
  () => route.fullPath,
  () => {
    layout.sidebarOpen = false;
  },
);

function select(id: string): void {
  void router.push({ name: 'chat', params: { id } });
}

function createNew(): void {
  void router.push({ name: 'chat' });
}

async function logout(): Promise<void> {
  await auth.logout();
  chat.reset();
  profile.reset();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <div
    v-if="layout.sidebarOpen"
    class="fixed inset-0 z-20 bg-black/30 backdrop-blur-[2px] md:hidden"
    aria-hidden="true"
    @click="layout.sidebarOpen = false"
  />
  <aside
    :class="[
      'bg-sidebar fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r transition-transform md:static md:translate-x-0',
      layout.sidebarOpen ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex h-14 shrink-0 items-center justify-between px-4">
      <AppLogo />
      <Button
        class="md:hidden"
        variant="ghost"
        size="icon-sm"
        aria-label="Seitenleiste schließen"
        @click="layout.sidebarOpen = false"
      >
        <X class="size-4" />
      </Button>
    </div>

    <nav class="flex flex-col gap-0.5 px-2 pt-1 pb-3" aria-label="Bereiche">
      <RouterLink
        v-for="item in NAV"
        :key="item.name"
        :to="{ name: item.name }"
        class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors"
        active-class="bg-accent text-foreground! font-medium"
        :data-testid="`nav-${item.name}`"
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <template v-if="route.name === 'chat'">
      <div class="flex items-center justify-between border-t px-4 pt-3 pb-1">
        <p class="text-muted-foreground text-xs font-medium">Gespräche</p>
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-muted-foreground -mr-2"
          aria-label="Neues Gespräch"
          title="Neues Gespräch"
          data-testid="new-chat"
          @click="createNew"
        >
          <SquarePen class="size-4" />
        </Button>
      </div>
      <div class="flex-1 overflow-y-auto px-2 pb-2">
        <ConversationList
          :conversations="chat.conversations"
          :active-id="chat.activeId"
          @select="select"
          @rename="(id, name) => chat.rename(id, name)"
          @remove="(id) => chat.remove(id)"
        />
      </div>
    </template>
    <div v-else class="flex-1" />

    <div class="flex items-center gap-2.5 border-t px-3 py-3 text-sm">
      <div
        class="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      >
        {{ initial }}
      </div>
      <span class="text-muted-foreground min-w-0 flex-1 truncate" data-testid="user-email">
        {{ auth.user?.email }}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        class="text-muted-foreground"
        aria-label="Abmelden"
        title="Abmelden"
        data-testid="logout"
        @click="logout"
      >
        <LogOut class="size-4" />
      </Button>
    </div>
  </aside>
</template>
