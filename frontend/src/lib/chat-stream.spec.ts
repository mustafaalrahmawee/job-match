import { afterEach, expect, it, vi } from 'vitest';

import { ApiError, setToken } from './api';
import { streamChat } from './chat-stream';

const REQUEST = { message: 'Hallo', model: 'standard', effort: 'low' } as const;
const ID = '6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11';

function mockStream(...chunks: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
  const fetchMock = vi.fn(() => Promise.resolve(new Response(body, { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function collect(signal = new AbortController().signal) {
  const events = [];
  for await (const event of streamChat(REQUEST, signal)) events.push(event);
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('yields the events in order, also when a frame is split across chunks', async () => {
  setToken('geheim');
  const fetchMock = mockStream(
    `event: conversation\ndata: {"type":"conversation","id":"${ID}"}\n\n`,
    'event: delta\ndata: {"type":"delta","text":"Hal"}\n\nevent: delta\ndata: {"type":"del',
    'ta","text":"lo"}\n\n',
    `event: done\ndata: {"type":"done","messageId":"${ID}","truncated":false}\n\n`,
  );

  const events = await collect();

  expect(events.map((event) => event.type)).toEqual(['conversation', 'delta', 'delta', 'done']);
  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer geheim');
});

it('throws ApiError for a rejected request and for an unknown event', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'x', message: 'Nicht da.' } }), {
          status: 404,
        }),
      ),
    ),
  );
  await expect(collect()).rejects.toMatchObject({ status: 404, message: 'Nicht da.' });

  mockStream('event: delta\ndata: {"type":"unbekannt"}\n\n');
  await expect(collect()).rejects.toBeInstanceOf(ApiError);
});
