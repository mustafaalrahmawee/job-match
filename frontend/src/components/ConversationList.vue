<script setup lang="ts">
import type { Conversation } from '@job-match/shared';
import { Pencil, Trash2 } from '@lucide/vue';
import { nextTick, ref } from 'vue';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

defineProps<{ conversations: readonly Conversation[]; activeId: string | null }>();
const emit = defineEmits<{
  select: [id: string];
  rename: [id: string, title: string];
  remove: [id: string];
}>();

const editingId = ref<string | null>(null);
const draft = ref('');
const deleteDialogOpen = ref(false);
const pendingDelete = ref<Conversation | null>(null);

function askDelete(conversation: Conversation): void {
  pendingDelete.value = conversation;
  deleteDialogOpen.value = true;
}

async function startRename(conversation: Conversation): Promise<void> {
  editingId.value = conversation.id;
  draft.value = conversation.title;
  await nextTick();
  document.querySelector<HTMLInputElement>('[data-testid="rename-input"]')?.select();
}

function commitRename(conversation: Conversation): void {
  if (editingId.value !== conversation.id) return;
  editingId.value = null;
  const title = draft.value.trim();
  if (title !== '' && title !== conversation.title) emit('rename', conversation.id, title);
}

function confirmDelete(): void {
  if (pendingDelete.value) emit('remove', pendingDelete.value.id);
}
</script>

<template>
  <nav aria-label="Gespräche">
    <p v-if="conversations.length === 0" class="text-muted-foreground px-3 py-2 text-sm">
      Noch keine Gespräche – stelle deine erste Frage.
    </p>
    <ul class="flex flex-col gap-0.5">
      <li
        v-for="conversation in conversations"
        :key="conversation.id"
        :class="[
          'group flex items-center rounded-lg transition-colors',
          conversation.id === activeId
            ? 'bg-background font-medium shadow-xs'
            : 'text-foreground/80 hover:bg-background/70',
        ]"
        data-testid="conversation-item"
      >
        <Input
          v-if="editingId === conversation.id"
          v-model="draft"
          class="h-8 flex-1"
          maxlength="100"
          aria-label="Neuer Titel"
          data-testid="rename-input"
          @keydown.enter.prevent="commitRename(conversation)"
          @keydown.esc.prevent="editingId = null"
          @blur="commitRename(conversation)"
        />
        <template v-else>
          <button
            type="button"
            class="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
            :aria-current="conversation.id === activeId ? 'page' : undefined"
            @click="emit('select', conversation.id)"
          >
            {{ conversation.title }}
          </button>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 shrink-0 md:hidden md:group-focus-within:inline-flex md:group-hover:inline-flex"
            aria-label="Gespräch umbenennen"
            data-testid="rename"
            @click="startRename(conversation)"
          >
            <Pencil class="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="mr-1 size-7 shrink-0 md:hidden md:group-focus-within:inline-flex md:group-hover:inline-flex"
            aria-label="Gespräch löschen"
            data-testid="delete"
            @click="askDelete(conversation)"
          >
            <Trash2 class="size-3.5" />
          </Button>
        </template>
      </li>
    </ul>

    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Gespräch löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{{ pendingDelete?.title }}“ und alle Nachrichten darin werden endgültig gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction data-testid="confirm-delete" @click="confirmDelete">
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </nav>
</template>
