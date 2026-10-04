import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildChatRequest } from '../../src/chat/chat.prompts';
import { parseConfig } from '../../src/config';
import { listMessages } from '../../src/conversations/conversations.service';
import { answerText, createLlmClient } from '../../src/llm/client';
import { describeLlmError } from '../../src/llm/errors';
import { ZAI_BASE_URL, resolveModels } from '../../src/llm/models';
import { TEST_DATABASE_URL, VALID_ENV, parseEvents, useTestDb } from '../helpers';

const API_KEY = process.env.TEST_ANTHROPIC_API_KEY;

const config = parseConfig({
  ...VALID_ENV,
  ANTHROPIC_API_KEY: API_KEY ?? 'missing',
  ANTHROPIC_BASE_URL: process.env.TEST_ANTHROPIC_BASE_URL ?? ZAI_BASE_URL,
});
const llm = createLlmClient(config);
const model = resolveModels(config.anthropicBaseUrl).standard;

const ask = (text: string, maxTokens = config.llmMaxTokens) =>
  buildChatRequest({
    history: [{ role: 'user', content: [{ type: 'text', text }] }],
    model,
    effort: 'low',
    maxTokens,
    historyLimit: config.chatHistoryLimit,
  });

describe.skipIf(!API_KEY)('coach_chat against the real model', () => {
  it('answers a coaching question completely', async () => {
    const message = await llm.messages
      .stream(ask('Wie lang sollte ein Anschreiben sein?'))
      .finalMessage();

    expect(message.model).toBe(model);
    expect(message.stop_reason).toBe('end_turn');
    expect(answerText(message).length).toBeGreaterThan(50);
    expect(message.usage.input_tokens).toBeGreaterThan(0);
    expect(message.usage.output_tokens).toBeGreaterThan(0);
  });

  it('stops with max_tokens when the limit is tiny', async () => {
    const message = await llm.messages.stream(ask('Erkläre die STAR-Methode.', 20)).finalMessage();

    expect(message.stop_reason).toBe('max_tokens');
  });

  it('rejects a wrong api key as misconfigured', async () => {
    const wrong = createLlmClient({ ...config, anthropicApiKey: 'wrong-key', llmMaxRetries: 0 });
    const error: unknown = await wrong.messages
      .stream(ask('Hallo'))
      .finalMessage()
      .catch((e: unknown) => e);

    expect(describeLlmError(error).code).toBe('llm_misconfigured');
  });
});

describe.skipIf(!API_KEY || !TEST_DATABASE_URL)('POST /api/chat against the real model', () => {
  const full = useTestDb({ llm, config });
  const short = useTestDb({ llm, config: { ...config, llmMaxTokens: 60 } });

  async function chat(testDb: typeof full, message: string) {
    const anna = await testDb.signIn();
    const response = await request(testDb.app)
      .post('/api/chat')
      .set(anna.headers)
      .send({ message, model: 'standard', effort: 'low' });
    const events = parseEvents(response.text);
    const first = events[0];
    const saved = await listMessages(
      testDb.db,
      anna.id,
      first?.type === 'conversation' ? first.id : '',
    );
    return { events, saved };
  }

  it('streams deltas, ends with done and saves the answer', async () => {
    const { events, saved } = await chat(full, 'Nenne zwei Tipps für ein Vorstellungsgespräch.');

    expect(events[0]?.type).toBe('conversation');
    expect(events.filter((event) => event.type === 'delta').length).toBeGreaterThan(0);
    expect(events.at(-1)).toMatchObject({ type: 'done', truncated: false });
    expect(saved.map(({ role, stopReason }) => ({ role, stopReason }))).toEqual([
      { role: 'user', stopReason: null },
      { role: 'assistant', stopReason: 'end_turn' },
    ]);
  });

  it('marks an answer cut off by max_tokens as truncated and keeps it', async () => {
    const { events, saved } = await chat(
      short,
      'Erkläre ausführlich die STAR-Methode mit Beispiel.',
    );

    expect(events.at(-1)).toMatchObject({ type: 'done', truncated: true });
    expect(saved.at(-1)).toMatchObject({ role: 'assistant', stopReason: 'max_tokens' });
  });
});
