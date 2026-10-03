import type { ChatEvent, ChatRequest } from '@job-match/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatStore } from './chat';

const api = vi.hoisted(() => ({ apiJson: vi.fn(), apiVoid: vi.fn(), streamChat: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiJson: api.apiJson,
  apiVoid: api.apiVoid,
}));
vi.mock('@/lib/chat-stream', () => ({ streamChat: api.streamChat }));

const ID = '6f1c5d2e-8b0a-4c1e-9a53-0d2a7a1f3b11';
const MSG = '0b8a1f64-77a3-4e52-8d0b-2e3f4a5b6c7d';
const NOW = '2026-10-02T10:00:00.000Z';

const conversation = { id: ID, title: 'Gespräch', createdAt: NOW, updatedAt: NOW };
const message = (role: 'user' | 'assistant', text: string, stopReason: string | null = null) => ({
  id: crypto.randomUUID(),
  role,
  content: [{ type: 'text', text }],
  stopReason,
  createdAt: NOW,
});

let serverMessages: ReturnType<typeof message>[] = [];

function events(...list: ChatEvent[]): AsyncGenerator<ChatEvent> {
  return (async function* () {
    for (const event of list) yield event;
  })();
}

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    serverMessages = [];
    api.apiJson.mockReset();
    api.apiVoid.mockReset();
    api.streamChat.mockReset();
    api.apiJson.mockImplementation((_method: string, path: string) => {
      if (path === '/api/conversations') return Promise.resolve([conversation]);
      return Promise.resolve({ ...conversation, messages: serverMessages });
    });
  });

  it('zeigt die Antwort live und übernimmt danach den gespeicherten Stand des Servers', async () => {
    const chat = useChatStore();
    const seenWhileStreaming: string[] = [];
    api.streamChat.mockImplementation(async function* (): AsyncGenerator<ChatEvent> {
      yield { type: 'conversation', id: ID };
      yield { type: 'delta', text: 'Hal' };
      seenWhileStreaming.push(chat.streamingText);
      yield { type: 'delta', text: 'lo' };
      seenWhileStreaming.push(chat.streamingText);
      serverMessages = [message('user', 'Frage'), message('assistant', 'Hallo', 'end_turn')];
      yield { type: 'done', messageId: MSG, truncated: false };
    });

    await chat.send('Frage');

    expect(seenWhileStreaming).toEqual(['Hal', 'Hallo']);
    expect(chat.activeId).toBe(ID);
    expect(chat.messages.map((entry) => entry.text)).toEqual(['Frage', 'Hallo']);
    expect(chat.streaming).toBe(false);
    expect(chat.streamingText).toBe('');
    expect(chat.error).toBeNull();
    expect(chat.conversations).toHaveLength(1);
  });

  it('stoppt ohne Fehlermeldung und zeigt die gespeicherte Teilantwort', async () => {
    const chat = useChatStore();
    api.streamChat.mockImplementation(async function* (_request: ChatRequest, signal: AbortSignal) {
      yield { type: 'conversation', id: ID } satisfies ChatEvent;
      yield { type: 'delta', text: 'Teil' } satisfies ChatEvent;
      await new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Abgebrochen', 'AbortError'));
        });
      });
    });
    serverMessages = [message('user', 'Frage'), message('assistant', 'Teil', 'aborted')];

    const sending = chat.send('Frage');
    await vi.waitFor(() => {
      expect(chat.streamingText).toBe('Teil');
    });
    chat.stop();
    await sending;

    expect(chat.error).toBeNull();
    expect(chat.streaming).toBe(false);
    expect(chat.messages.at(-1)).toMatchObject({ text: 'Teil', stopReason: 'aborted' });
  });

  it('merkt sich eine Ablehnung (refusal) und erlaubt „Erneut versuchen“', async () => {
    const chat = useChatStore();
    serverMessages = [message('user', 'Frage')];
    api.streamChat.mockImplementation(() =>
      events({ type: 'conversation', id: ID }, { type: 'delta', text: 'x' }, { type: 'refusal' }),
    );

    await chat.send('Frage');

    expect(chat.refused).toBe(true);
    expect(chat.messages.map((entry) => entry.role)).toEqual(['user']);
    expect(chat.canRetry).toBe(true);
  });

  it('zeigt die Fehlermeldung aus dem Stream und erlaubt „Erneut versuchen“', async () => {
    const chat = useChatStore();
    serverMessages = [message('user', 'Frage')];
    api.streamChat.mockImplementation(() =>
      events(
        { type: 'conversation', id: ID },
        {
          type: 'error',
          code: 'llm_unavailable',
          message: 'Der KI-Anbieter ist nicht erreichbar.',
        },
      ),
    );

    await chat.send('Frage');

    expect(chat.error).toBe('Der KI-Anbieter ist nicht erreichbar.');
    expect(chat.canRetry).toBe(true);
  });

  it('retry schickt keine neue Nachricht, sondern setzt das Gespräch fort', async () => {
    const chat = useChatStore();
    chat.activeId = ID;
    chat.messages = [{ id: 'a', role: 'user', text: 'Frage', stopReason: null }];
    serverMessages = [message('user', 'Frage')];
    api.streamChat.mockImplementation(() =>
      events({ type: 'done', messageId: MSG, truncated: false }),
    );

    await chat.retry();

    expect(api.streamChat.mock.calls[0]?.[0]).toEqual({
      conversationId: ID,
      model: 'standard',
      effort: 'low',
    });
  });
});
