import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, setToken } from '@/lib/api';

import { router } from './index';

const api = vi.hoisted(() => ({ apiJson: vi.fn(), apiVoid: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiJson: api.apiJson,
  apiVoid: api.apiVoid,
}));

describe('Router-Guard', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    api.apiJson.mockReset();
    localStorage.clear();
    await router.replace('/login');
  });

  it('leitet Abgemeldete vom Chat zum Login', async () => {
    await router.push('/chat');

    expect(router.currentRoute.value.name).toBe('login');
  });

  it('merkt sich das Ziel für nach dem Login', async () => {
    await router.push('/chat/6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11');

    expect(router.currentRoute.value.query.redirect).toBe(
      '/chat/6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11',
    );
  });

  it('lässt Angemeldete zum Chat und schickt sie vom Login dorthin', async () => {
    setToken('gueltig');
    setActivePinia(createPinia());
    api.apiJson.mockResolvedValue({ id: '6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11', email: 'a@b.de' });

    await router.push('/chat');
    expect(router.currentRoute.value.name).toBe('chat');

    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('chat');
  });

  it('behandelt ein abgelehntes gespeichertes Token wie keine Anmeldung', async () => {
    setToken('abgelaufen');
    setActivePinia(createPinia());
    api.apiJson.mockRejectedValue(new ApiError(401, 'Bitte melde dich an.'));

    await router.push('/chat');

    expect(router.currentRoute.value.name).toBe('login');
  });
});
