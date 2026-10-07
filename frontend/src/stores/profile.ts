import { CvListSchema, CvSchema, MAX_CV_BYTES } from '@job-match/shared';
import type { Cv, Role } from '@job-match/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { ApiError, apiBlob, apiJson, apiUpload, apiVoid } from '@/lib/api';

function messageOf(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : 'Es ist ein Fehler aufgetreten.';
}

export const useProfileStore = defineStore('profile', () => {
  const cvs = ref<Cv[]>([]);
  const uploading = ref(false);
  const error = ref<string | null>(null);

  const active = computed(() => cvs.value.find((cv) => cv.active) ?? null);
  const archived = computed(() => cvs.value.filter((cv) => !cv.active));
  const analyzing = computed(() => cvs.value.some((cv) => cv.analysisStatus === 'running'));

  async function attempt(action: () => Promise<void>): Promise<void> {
    error.value = null;
    try {
      await action();
    } catch (cause) {
      error.value = messageOf(cause);
    }
  }

  async function load(): Promise<void> {
    await attempt(async () => {
      cvs.value = await apiJson('GET', '/api/cvs', CvListSchema);
    });
  }

  async function refresh(): Promise<void> {
    const list = await apiJson('GET', '/api/cvs', CvListSchema).catch(() => null);
    if (list) cvs.value = list;
  }

  async function upload(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
      error.value = 'Bitte lade eine PDF-Datei hoch.';
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      error.value = 'Die Datei ist zu groß (höchstens 5 MB).';
      return;
    }
    uploading.value = true;
    await attempt(async () => {
      const cv = await apiUpload('/api/cvs', file, CvSchema);
      cvs.value = await apiJson('GET', '/api/cvs', CvListSchema);
      replace(await apiJson('POST', `/api/cvs/${cv.id}/analysis`, CvSchema));
    });
    uploading.value = false;
  }

  function replace(updated: Cv): void {
    cvs.value = cvs.value.map((cv) => (cv.id === updated.id ? updated : cv));
  }

  async function analyze(id: string): Promise<void> {
    await attempt(async () => {
      replace(await apiJson('POST', `/api/cvs/${id}/analysis`, CvSchema));
    });
  }

  async function setRole(id: string, role: Role): Promise<void> {
    await attempt(async () => {
      replace(await apiJson('PATCH', `/api/cvs/${id}`, CvSchema, { role }));
    });
  }

  async function activate(id: string): Promise<void> {
    await attempt(async () => {
      await apiJson('POST', `/api/cvs/${id}/activate`, CvSchema);
      cvs.value = await apiJson('GET', '/api/cvs', CvListSchema);
    });
  }

  async function remove(ids: readonly string[]): Promise<void> {
    await attempt(async () => {
      await apiVoid('POST', '/api/cvs/delete', { ids });
      cvs.value = cvs.value.filter((cv) => !ids.includes(cv.id));
    });
  }

  async function openPdf(id: string): Promise<void> {
    await attempt(async () => {
      const url = URL.createObjectURL(await apiBlob(`/api/cvs/${id}/pdf`));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  function reset(): void {
    cvs.value = [];
    error.value = null;
  }

  return {
    cvs,
    uploading,
    error,
    active,
    archived,
    analyzing,
    load,
    refresh,
    upload,
    analyze,
    setRole,
    activate,
    remove,
    openPdf,
    reset,
  };
});
