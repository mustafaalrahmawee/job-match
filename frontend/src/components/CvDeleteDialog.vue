<script setup lang="ts">
import { computed } from 'vue';

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

const open = defineModel<boolean>('open', { required: true });
const props = defineProps<{ count: number; includesActive: boolean }>();
const emit = defineEmits<{ confirm: [] }>();

const title = computed(() =>
  props.count === 1 ? 'Fassung löschen?' : `${props.count} Fassungen löschen?`,
);
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>
          Das PDF und alles, was die KI daraus erstellt hat (Analyse, Match-Ergebnisse), werden
          endgültig gelöscht. Bewerbungen und Chats bleiben erhalten.
          <template v-if="includesActive">
            Danach ist keine Fassung aktiv – wähle eine aus dem Archiv oder lade eine neue hoch.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive hover:bg-destructive/90 text-white"
          data-testid="confirm-delete-cv"
          @click="emit('confirm')"
        >
          Löschen
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
