import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { COACH_CHAT_SYSTEM_PROMPT, boundHistory, buildChatRequest } from '../src/chat/chat.prompts';
import { startConversation } from '../src/conversations/conversations.service';
import { TEST_DATABASE_URL, useTestDb } from './helpers';

const user = (text: string) => ({
  role: 'user' as const,
  content: [{ type: 'text' as const, text }],
});
const assistant = (text: string) => ({
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text }],
});

describe('boundHistory', () => {
  it('keeps only the last messages and starts with a user message', () => {
    const history = [user('1'), assistant('2'), user('3'), assistant('4'), user('5')];

    expect(boundHistory(history, 3).map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);
    expect(boundHistory(history, 2)).toEqual([user('5')]);
    expect(boundHistory([assistant('x')], 10)).toEqual([]);
  });

  it('merges consecutive messages of the same role', () => {
    expect(boundHistory([user('Frage'), user('Noch einmal')], 10)).toEqual([
      { role: 'user', content: [...user('Frage').content, ...user('Noch einmal').content] },
    ]);
  });
});

it('buildChatRequest sends model, limit, system prompt and an explicit effort', () => {
  const params = buildChatRequest({
    history: [user('Hallo')],
    model: 'm',
    effort: 'low',
    maxTokens: 500,
    historyLimit: 10,
  });

  expect(params).toMatchObject({
    model: 'm',
    max_tokens: 500,
    output_config: { effort: 'low' },
    system: COACH_CHAT_SYSTEM_PROMPT,
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

describe.skipIf(!TEST_DATABASE_URL)('POST /api/chat', () => {
  const { db, app, signIn } = useTestDb();
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
  });
});
