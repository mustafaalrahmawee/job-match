import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

import { useHealthStore } from './health';

const { getJson } = vi.hoisted(() => ({ getJson: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getJson,
}));

describe('health store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getJson.mockReset();
  });

  it('meldet ok, wenn das Backend 200 antwortet', async () => {
    getJson.mockResolvedValue({ status: 'ok', database: 'ok' });
    const health = useHealthStore();

    await health.load();

    expect(health.state).toBe('ok');
    expect(health.database).toBe('ok');
    expect(health.loading).toBe(false);
  });

  it('meldet degraded, wenn die Datenbank fehlt (503 mit gleicher Form)', async () => {
    getJson.mockResolvedValue({ status: 'degraded', database: 'error' });
    const health = useHealthStore();

    await health.load();

    expect(health.state).toBe('degraded');
    expect(health.database).toBe('error');
  });

  it('meldet unreachable, wenn das Backend gar nicht antwortet', async () => {
    getJson.mockRejectedValue(new TypeError('fetch failed'));
    const health = useHealthStore();

    await health.load();

    expect(health.state).toBe('unreachable');
    expect(health.database).toBeNull();
  });

  it('meldet unreachable, wenn die Antwort nicht zum Schema passt', async () => {
    getJson.mockRejectedValue(new ApiError(502, 'Unerwartete Antwort'));
    const health = useHealthStore();

    await health.load();

    expect(health.state).toBe('unreachable');
  });
});
