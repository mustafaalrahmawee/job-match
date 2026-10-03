import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiJson, getToken, setToken, setUnauthorizedHandler } from './api';

const OkSchema = z.object({ status: z.literal('ok') });

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  setUnauthorizedHandler(undefined);
});

it('sends the token as bearer header', async () => {
  setToken('abc');
  const fetchMock = mockFetch(200, { status: 'ok' });

  await apiJson('GET', '/api/x', OkSchema);

  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
});

it('uses the backend message and falls back to a general one', async () => {
  mockFetch(404, { error: { code: 'x', message: 'Nicht da.' } });
  await expect(apiJson('GET', '/api/x', OkSchema)).rejects.toMatchObject({
    status: 404,
    message: 'Nicht da.',
  });

  mockFetch(502, '<html>Bad Gateway</html>');
  await expect(apiJson('GET', '/api/x', OkSchema)).rejects.toThrow(
    'Es ist ein Fehler aufgetreten.',
  );
});

it('drops the token and calls the handler only on 401 with a sent token', async () => {
  const handler = vi.fn();
  setUnauthorizedHandler(handler);
  mockFetch(401, { error: { code: 'invalid_credentials', message: 'Falsch.' } });

  await expect(apiJson('POST', '/api/auth/login', OkSchema, {})).rejects.toThrow('Falsch.');
  expect(handler).not.toHaveBeenCalled();

  setToken('abgelaufen');
  await expect(apiJson('GET', '/api/auth/me', OkSchema)).rejects.toThrow();
  expect(getToken()).toBeNull();
  expect(handler).toHaveBeenCalledOnce();
});
