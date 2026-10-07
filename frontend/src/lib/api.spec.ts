import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  apiBlob,
  apiJson,
  apiUpload,
  apiVoid,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from './api';

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

it('uploads a file as raw body with its content type, encoded name and the token', async () => {
  setToken('abc');
  const fetchMock = mockFetch(201, { status: 'ok' });
  const file = new File(['%PDF-1.4'], 'Lebenslauf Jürgen.pdf', { type: 'application/pdf' });

  await apiUpload('/api/cvs', file, OkSchema);

  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(init.body).toBe(file);
  expect(init.headers).toMatchObject({
    Authorization: 'Bearer abc',
    'Content-Type': 'application/pdf',
    'X-File-Name': 'Lebenslauf%20J%C3%BCrgen.pdf',
  });
});

it('returns a binary response as blob', async () => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('%PDF-1.4', { status: 200 })));

  const blob = await apiBlob('/api/cvs/1/pdf');

  expect(await blob.text()).toBe('%PDF-1.4');
});

it('sends a json body with apiVoid', async () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);

  await apiVoid('POST', '/api/cvs/delete', { ids: ['a'] });

  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(init.body).toBe('{"ids":["a"]}');
  expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
});
