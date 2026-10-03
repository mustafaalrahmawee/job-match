import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import { ApiError } from '@/lib/api';

import LoginPage from './LoginPage.vue';

const api = vi.hoisted(() => ({ apiJson: vi.fn(), apiVoid: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiJson: api.apiJson,
  apiVoid: api.apiVoid,
}));

const AUTH = {
  token: 'neu',
  expiresAt: '2026-11-01T00:00:00.000Z',
  user: { id: '6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11', email: 'anna@example.com' },
};

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: LoginPage },
      { path: '/chat/:id?', name: 'chat', component: { template: '<div />' } },
      { path: '/elsewhere', component: { template: '<div />' } },
    ],
  });
  await router.push(path);
  const wrapper = mount(LoginPage, { global: { plugins: [router] } });
  return { wrapper, router };
}

async function fill(
  wrapper: Awaited<ReturnType<typeof mountAt>>['wrapper'],
  email: string,
  pw: string,
) {
  await wrapper.get('[data-testid="email"]').setValue(email);
  await wrapper.get('[data-testid="password"]').setValue(pw);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('LoginPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.apiJson.mockReset();
    localStorage.clear();
  });

  it('meldet an und führt zum Chat', async () => {
    api.apiJson.mockResolvedValue(AUTH);
    const { wrapper, router } = await mountAt('/login');

    await fill(wrapper, ' Anna@Example.com ', 'ein-langes-passwort');

    expect(api.apiJson).toHaveBeenCalledWith('POST', '/api/auth/login', expect.anything(), {
      email: 'anna@example.com',
      password: 'ein-langes-passwort',
    });
    expect(router.currentRoute.value.name).toBe('chat');
  });

  it('zeigt die Meldung des Backends bei falschen Zugangsdaten und bleibt auf der Seite', async () => {
    api.apiJson.mockRejectedValue(new ApiError(401, 'E-Mail oder Passwort ist falsch.'));
    const { wrapper, router } = await mountAt('/login');

    await fill(wrapper, 'anna@example.com', 'falsch');

    expect(wrapper.get('[data-testid="login-error"]').text()).toBe(
      'E-Mail oder Passwort ist falsch.',
    );
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('folgt keinem Redirect auf eine fremde Adresse', async () => {
    api.apiJson.mockResolvedValue(AUTH);
    const { wrapper, router } = await mountAt('/login?redirect=//evil.example');

    await fill(wrapper, 'anna@example.com', 'ein-langes-passwort');

    expect(router.currentRoute.value.name).toBe('chat');
  });
});
