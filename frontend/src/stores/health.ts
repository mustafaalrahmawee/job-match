import { HealthResponseSchema } from '@job-match/shared';
import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getJson } from '@/lib/api';

/** `unreachable` heißt: Das Backend antwortet gar nicht – anders als eine 503-Antwort. */
export type HealthState = 'unknown' | 'ok' | 'degraded' | 'unreachable';

export const useHealthStore = defineStore('health', () => {
  const state = ref<HealthState>('unknown');
  const database = ref<'ok' | 'error' | null>(null);
  const loading = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    try {
      // Bei 503 hat der Körper dieselbe Form wie bei 200; `status` sagt, was los ist.
      const body = await getJson('/api/health', HealthResponseSchema);
      state.value = body.status;
      database.value = body.database;
    } catch {
      // Netzwerkfehler oder fremde Antwort: Backend nicht gestartet oder Proxy falsch konfiguriert.
      state.value = 'unreachable';
      database.value = null;
    } finally {
      loading.value = false;
    }
  }

  return { state, database, loading, load };
});
