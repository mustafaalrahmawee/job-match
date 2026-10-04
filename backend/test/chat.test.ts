import Anthropic from '@anthropic-ai/sdk';
import type { StopReason } from '@anthropic-ai/sdk/resources/messages';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { COACH_CHAT_SYSTEM_PROMPT, buildChatRequest } from '../src/chat/chat.prompts';
import { listMessages, startConversation } from '../src/conversations/conversations.service';
import { TEST_DATABASE_URL, parseEvents, useTestDb } from './helpers';

const user = (text: string) => ({
  role: 'user' as const,
  content: [{ type: 'text' as const, text }],
});
const assistant = (text: string) => ({
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text }],
});

const build = (history: Parameters<typeof buildChatRequest>[0]['history'], historyLimit = 10) =>
  buildChatRequest({ history, model: 'm', effort: 'low', maxTokens: 500, historyLimit });

describe('buildChatRequest', () => {
  it('sends model, limit, system prompt and an explicit effort', () => {
    expect(build([user('Hallo')])).toMatchObject({
      model: 'm',
      max_tokens: 500,
      output_config: { effort: 'low' },
      system: COACH_CHAT_SYSTEM_PROMPT,
    });
  });

  it('keeps only the last messages and starts with a user message', () => {
    const history = [user('1'), assistant('2'), user('3'), assistant('4'), user('5')];

    expect(build(history, 3).messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
    expect(build(history, 2).messages).toEqual([user('5')]);
    expect(build([assistant('x')]).messages).toEqual([]);
  });

  it('merges consecutive messages of the same role', () => {
    expect(build([user('Frage'), user('Noch einmal')]).messages).toEqual([
      { role: 'user', content: [...user('Frage').content, ...user('Noch einmal').content] },
    ]);
  });
});

it('the coach prompt follows the prompt rules', () => {
  expect(
    COACH_CHAT_SYSTEM_PROMPT.startsWith('Dies ist das Protokoll eines Karriere-Coachings'),
  ).toBe(true);
  expect(COACH_CHAT_SYSTEM_PROMPT).not.toMatch(/\b(AP|RP)-\d+/);
  expect(COACH_CHAT_SYSTEM_PROMPT).not.toMatch(/du bist|you are|act as/i);
  expect(COACH_CHAT_SYSTEM_PROMPT).not.toMatch(/\b(nie|niemals|immer|never|always)\b/i);
});

function mockStream(reply: { text: string; stopReason?: StopReason; error?: Error }) {
  return {
    *[Symbol.iterator]() {
      for (const text of reply.text.split(/(?<= )/).filter(Boolean)) {
        yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
      }
      if (reply.error) throw reply.error;
    },
    finalMessage: () =>
      Promise.resolve({
        model: 'mock-model',
        stop_reason: reply.stopReason ?? 'end_turn',
        stop_details: null,
        content: [{ type: 'text', text: reply.text }],
        usage: { input_tokens: 12, output_tokens: 34 },
      }),
  };
}

describe.skipIf(!TEST_DATABASE_URL)('POST /api/chat', () => {
  const stream = vi.fn();
  const { db, app, signIn } = useTestDb({ llm: { messages: { stream } } as unknown as Anthropic });
  const BODY = { message: 'Wie bereite ich mich vor?', model: 'standard', effort: 'low' };

  it('requires a login', async () => {
    expect((await request(app).post('/api/chat').send(BODY)).status).toBe(401);
  });

  it('answers 400 for an invalid request and 404 for a foreign conversation as json', async () => {
    const anna = await signIn();
    const ben = await signIn();
    const conversation = await startConversation(db, anna.id, 'Privat');

    const invalid = await request(app)
      .post('/api/chat')
      .set(anna.headers)
      .send({ ...BODY, effort: 'max' });
    const foreign = await request(app)
      .post('/api/chat')
      .set(ben.headers)
      .send({ ...BODY, conversationId: conversation.id });

    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(404);
    expect(foreign.headers['content-type']).toContain('application/json');

    const foreignRetry = await request(app)
      .post('/api/chat')
      .set(ben.headers)
      .send({ conversationId: conversation.id, model: 'standard', effort: 'low' });
    expect(foreignRetry.status).toBe(400);
  });

  async function chat(reply: Parameters<typeof mockStream>[0]) {
    const anna = await signIn();
    stream.mockReturnValueOnce(mockStream(reply));
    const response = await request(app).post('/api/chat').set(anna.headers).send(BODY);
    const events = parseEvents(response.text);
    const conversationId = events[0]?.type === 'conversation' ? events[0].id : '';
    const saved = await listMessages(db, anna.id, conversationId);
    return { response, events, saved };
  }

  it('streams the answer, saves it and sends the built prompt to the model', async () => {
    const { response, events, saved } = await chat({ text: 'Lies die Anzeige genau.' });

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(events.map((event) => event.type)).toEqual([
      'conversation',
      'delta',
      'delta',
      'delta',
      'delta',
      'done',
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      messageId: saved[1]?.id,
      truncated: false,
    });
    expect(saved.map(({ role, stopReason }) => ({ role, stopReason }))).toEqual([
      { role: 'user', stopReason: null },
      { role: 'assistant', stopReason: 'end_turn' },
    ]);
    expect(saved[1]?.content).toEqual([{ type: 'text', text: 'Lies die Anzeige genau.' }]);
    expect(stream).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5-5',
        system: COACH_CHAT_SYSTEM_PROMPT,
        output_config: { effort: 'low' },
        messages: [user(BODY.message)],
      }),
      { signal: expect.any(AbortSignal) as AbortSignal },
    );
  });

  it('marks an answer cut off by max_tokens as truncated', async () => {
    const { events, saved } = await chat({ text: 'Erstens', stopReason: 'max_tokens' });

    expect(events.at(-1)).toMatchObject({ type: 'done', truncated: true });
    expect(saved.at(-1)?.stopReason).toBe('max_tokens');
  });

  it('discards the partial answer on a refusal', async () => {
    const { events, saved } = await chat({ text: 'Das kann', stopReason: 'refusal' });

    expect(events.at(-1)).toEqual({ type: 'refusal' });
    expect(saved.map((message) => message.role)).toEqual(['user']);
  });

  it('reports an empty answer as an error and saves nothing', async () => {
    const { events, saved } = await chat({ text: '  ' });

    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'empty_response' });
    expect(saved.map((message) => message.role)).toEqual(['user']);
  });

  it('saves the partial answer when the provider fails mid-stream', async () => {
    const { events, saved } = await chat({
      text: 'Zuerst ',
      error: new Anthropic.InternalServerError(500, undefined, 'boom', new Headers()),
    });

    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'llm_unavailable' });
    expect(saved.at(-1)).toMatchObject({
      role: 'assistant',
      stopReason: 'error',
      content: [{ type: 'text', text: 'Zuerst' }],
    });
  });
});
