import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { expect, it, vi } from 'vitest';

import StatusPage from './StatusPage.vue';

const { getJson } = vi.hoisted(() => ({ getJson: vi.fn() }));
vi.mock('@/lib/api', () => ({ getJson }));

it('zeigt den Zustand aus dem Health-Check', async () => {
  getJson.mockResolvedValue({ status: 'ok', database: 'ok' });

  const page = mount(StatusPage, { global: { plugins: [createPinia()] } });
  await vi.waitFor(() => expect(page.get('[data-testid="backend-state"]').text()).toBe('ok'));

  expect(page.get('[data-testid="status-text"]').text()).toContain('antworten');
  expect(page.get('[data-testid="database-state"]').text()).toBe('ok');
});
