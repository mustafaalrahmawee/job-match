import { AuthResponseSchema, UserSchema } from '@job-match/shared';
import type { User } from '@job-match/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { apiJson, apiVoid, clearToken, getToken, setToken } from '@/lib/api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const ready = ref(false);
  const isAuthenticated = computed(() => user.value !== null);

  async function restore(): Promise<void> {
    if (ready.value) return;
    try {
      if (getToken()) user.value = await apiJson('GET', '/api/auth/me', UserSchema);
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const auth = await apiJson('POST', '/api/auth/login', AuthResponseSchema, { email, password });
    setToken(auth.token);
    user.value = auth.user;
    ready.value = true;
  }

  async function logout(): Promise<void> {
    await apiVoid('POST', '/api/auth/logout').catch(() => undefined);
    reset();
  }

  function reset(): void {
    clearToken();
    user.value = null;
    ready.value = true;
  }

  return { user, ready, isAuthenticated, restore, login, logout, reset };
});
