<script setup lang="ts">
import { CircleAlert, Upload } from '@lucide/vue';
import { onMounted, ref } from 'vue';

import CvActiveCard from '@/components/CvActiveCard.vue';
import CvArchiveList from '@/components/CvArchiveList.vue';
import CvDeleteDialog from '@/components/CvDeleteDialog.vue';
import CvDropTarget from '@/components/CvDropTarget.vue';
import CvHowItWorks from '@/components/CvHowItWorks.vue';
import CvUploadZone from '@/components/CvUploadZone.vue';
import PageHeader from '@/components/PageHeader.vue';
import SectionHeading from '@/components/SectionHeading.vue';
import { Button } from '@/components/ui/button';
import { useProfileStore } from '@/stores/profile';

const profile = useProfileStore();
const fileInput = ref<HTMLInputElement | null>(null);
const pendingIds = ref<string[]>([]);
const deleteDialogOpen = ref(false);

onMounted(() => profile.load());

function chooseFile(): void {
  fileInput.value?.click();
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await profile.upload(file);
}

function askDelete(ids: string[]): void {
  pendingIds.value = ids;
  deleteDialogOpen.value = true;
}
</script>

<template>
  <PageHeader title="Mein Lebenslauf">
    <input
      ref="fileInput"
      type="file"
      accept="application/pdf"
      class="hidden"
      data-testid="cv-file"
      @change="onFile"
    />
    <Button size="sm" :disabled="profile.uploading" data-testid="cv-upload" @click="chooseFile">
      <Upload class="size-3.5" />
      <span v-if="profile.uploading">Wird hochgeladen …</span>
      <span v-else>Neue Fassung<span class="hidden sm:inline"> hochladen</span></span>
    </Button>
  </PageHeader>

  <CvDropTarget @file="profile.upload">
    <div class="flex-1 overflow-y-auto">
      <div
        class="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_16rem]"
      >
        <div class="flex min-w-0 flex-col gap-10">
          <div
            v-if="profile.error"
            class="border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
            role="alert"
            data-testid="banner"
          >
            <CircleAlert class="size-4 shrink-0" />
            <span>{{ profile.error }}</span>
          </div>

          <section class="flex flex-col gap-3">
            <SectionHeading
              title="Aktive Fassung"
              description="Mit dieser Fassung arbeiten der Coach und später Stellen und Matches."
            />
            <CvActiveCard
              v-if="profile.active"
              :cv="profile.active"
              @open="profile.openPdf"
              @remove="askDelete"
              @role="profile.setRole"
            />
            <CvUploadZone
              v-else
              :title="
                profile.archived.length > 0 ? 'Keine Fassung aktiv' : 'Lade deinen Lebenslauf hoch'
              "
              :hint="
                profile.archived.length > 0
                  ? 'Lade ein neues PDF hoch oder setze unten eine frühere Fassung aktiv.'
                  : 'PDF, höchstens 5 MB – klicken oder hierher ziehen'
              "
              :uploading="profile.uploading"
              @choose="chooseFile"
            />
          </section>

          <CvArchiveList
            v-if="profile.archived.length > 0"
            :cvs="profile.archived"
            @open="profile.openPdf"
            @activate="profile.activate"
            @remove="askDelete"
          />
        </div>

        <CvHowItWorks class="self-start lg:sticky lg:top-0" />
      </div>
    </div>
  </CvDropTarget>

  <CvDeleteDialog
    v-model:open="deleteDialogOpen"
    :count="pendingIds.length"
    :includes-active="profile.active !== null && pendingIds.includes(profile.active.id)"
    @confirm="profile.remove(pendingIds)"
  />
</template>
