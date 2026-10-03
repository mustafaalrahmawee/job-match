import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { COACH_CHAT_SYSTEM_PROMPT, buildChatRequest } from '../src/chat/chat.prompts';
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

    const foreignRetry = await request(app)
      .post('/api/chat')
      .set(ben.headers)
      .send({ conversationId: conversation.id, model: 'standard', effort: 'low' });
    expect(foreignRetry.status).toBe(400);
  });
});
