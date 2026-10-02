import { HealthResponseSchema } from '@job-match/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, getJson } from './api';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

describe('getJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('liefert den geprüften Körper, auch bei 503', async () => {
    mockFetch(503, { status: 'degraded', database: 'error' });

    await expect(getJson('/api/health', HealthResponseSchema)).resolves.toEqual({
      status: 'degraded',
      database: 'error',
    });
  });

  it('wirft ApiError, wenn der Körper nicht zum Schema passt', async () => {
    mockFetch(200, { status: 'vielleicht' });

    await expect(getJson('/api/health', HealthResponseSchema)).rejects.toBeInstanceOf(ApiError);
  });
});
