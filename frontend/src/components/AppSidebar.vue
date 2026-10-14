<template>
  <div
    v-if="layout.floating"
    class="fixed inset-0 z-20 bg-black/30 backdrop-blur-[2px] md:hidden"
    aria-hidden="true"
    @click="layout.close()"
  />
  <aside
    ref="sidebar"
    :class="[
      'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-sidebar transition-transform',
      layout.floating ? 'translate-x-0 shadow-xl' : '-translate-x-full',
      layout.pinned && 'md:static md:translate-x-0 md:shadow-none',
    ]"
  >
    <div class="flex h-14 shrink-0 items-center justify-between px-4">
      <AppLogo />
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Seitenleiste umschalten"
        title="Seitenleiste umschalten"
        @click="layout.toggle()"
      >
        <PanelLeft class="size-4" />
      </button>
    </div>

    <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-1 pb-3">
      <RouterLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        class="flex h-9 items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :class="isActive(item) && 'bg-accent font-medium text-foreground!'"
      >
        <component :is="item.icon" class="size-4" />
        {{ item.label }}
      </RouterLink>

      <p v-if="coach.conversations.length" class="mt-3 px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
        Gespräche
      </p>
      <p v-if="listError" class="px-3 py-1 text-xs text-destructive" role="alert">{{ listError }}</p>
      <div
        v-for="conversation in coach.conversations"
        :key="conversation.id"
        :class="['group relative flex items-center rounded-md hover:bg-accent', isOpen(conversation) && 'bg-accent']"
      >
        <RouterLink
          :to="`/coach/${conversation.id}`"
          :class="[
            'flex h-9 min-w-0 flex-1 items-center pr-15 pl-3 text-sm group-hover:text-foreground',
            isOpen(conversation) ? 'font-medium text-foreground' : 'text-muted-foreground',
          ]"
        >
          <span class="truncate">{{ conversation.title }}</span>
        </RouterLink>
        <div class="absolute right-1 hidden items-center group-hover:flex">
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Gespräch umbenennen"
            title="Gespräch umbenennen"
            @click="openRename(conversation)"
          >
            <Pencil class="size-3.5" />
          </button>
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
            aria-label="Gespräch löschen"
            title="Gespräch löschen"
            @click="openDelete(conversation)"
          >
            <Trash2 class="size-3.5" />
          </button>
        </div>
      </div>
    </nav>

    <div v-if="auth.user" class="flex items-center gap-2.5 border-t px-3 py-3 text-sm">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
      >
        {{ auth.user.email.charAt(0).toUpperCase() }}
      </div>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate font-medium">{{ auth.user.email }}</span>
        <span class="truncate text-xs text-muted-foreground">Bewerber:in</span>
      </div>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Abmelden"
        title="Abmelden"
        @click="logout"
      >
        <LogOut class="size-4" />
      </button>
    </div>
  </aside>

  <AppDialog
    :open="renaming !== null"
    title="Gespräch umbenennen"
    confirm-label="Speichern"
    :disabled="busy || !draftTitle.trim()"
    :error="dialogError"
    @confirm="saveTitle"
    @cancel="renaming = null"
  >
    <input
      v-model="draftTitle"
      maxlength="200"
      aria-label="Titel"
      autofocus
      class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
    />
  </AppDialog>

  <AppDialog
    :open="deleting !== null"
    title="Gespräch löschen?"
    confirm-label="Löschen"
    destructive
    :disabled="busy"
    :error="dialogError"
    @confirm="confirmDelete"
    @cancel="deleting = null"
  >
    <p class="text-sm text-muted-foreground">„{{ deleting?.title }}“ wird mit allen Nachrichten gelöscht.</p>
  </AppDialog>
</template>

<script setup lang="ts">
import { House, LogOut, MessageSquare, PanelLeft, Pencil, Trash2 } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCoachStore } from '../stores/coach'
import { useLayoutStore } from '../stores/layout'
import type { ConversationSummary } from '../types'
import AppDialog from './AppDialog.vue'
import AppLogo from './AppLogo.vue'

const NAV = [
  { to: '/', label: 'Start', icon: House, exact: true },
  { to: '/coach', label: 'Coach', icon: MessageSquare, exact: false },
]

const auth = useAuthStore()
const coach = useCoachStore()
const layout = useLayoutStore()
const route = useRoute()
const router = useRouter()
const sidebar = useTemplateRef('sidebar')
const listError = ref<string | null>(null)
const renaming = ref<ConversationSummary | null>(null)
const deleting = ref<ConversationSummary | null>(null)
const draftTitle = ref('')
const busy = ref(false)
const dialogError = ref<string | null>(null)

function isActive(item: (typeof NAV)[number]) {
  return item.exact ? route.path === item.to : route.path.startsWith(item.to)
}

function closeWhenMouseLeaves(event: MouseEvent) {
  if (layout.floating && sidebar.value && event.clientX > sidebar.value.offsetWidth) layout.close()
}

onMounted(() => document.addEventListener('mousemove', closeWhenMouseLeaves))
onMounted(async () => {
  try {
    await coach.loadList()
  } catch {
    listError.value = 'Gespräche konnten nicht geladen werden.'
  }
})
onBeforeUnmount(() => document.removeEventListener('mousemove', closeWhenMouseLeaves))

watch(
  () => route.fullPath,
  () => layout.close(),
)

function isOpen(conversation: ConversationSummary) {
  return route.params.id === String(conversation.id)
}

function openRename(conversation: ConversationSummary) {
  dialogError.value = null
  draftTitle.value = conversation.title
  renaming.value = conversation
}

function openDelete(conversation: ConversationSummary) {
  dialogError.value = null
  deleting.value = conversation
}

async function saveTitle() {
  const conversation = renaming.value
  const title = draftTitle.value.trim()
  if (!conversation || !title) return
  busy.value = true
  try {
    if (title !== conversation.title) await coach.rename(conversation.id, title)
    renaming.value = null
  } catch {
    dialogError.value = 'Umbenennen hat nicht geklappt.'
  } finally {
    busy.value = false
  }
}

async function confirmDelete() {
  const conversation = deleting.value
  if (!conversation) return
  const wasOpen = coach.conversationId === conversation.id
  busy.value = true
  try {
    await coach.remove(conversation.id)
    deleting.value = null
    if (wasOpen) await router.replace('/coach')
  } catch {
    dialogError.value = 'Löschen hat nicht geklappt.'
  } finally {
    busy.value = false
  }
}

async function logout() {
  coach.startNew()
  coach.conversations = []
  try {
    await auth.logout()
  } catch {
    return
  } finally {
    await router.replace('/login')
  }
}
</script>
