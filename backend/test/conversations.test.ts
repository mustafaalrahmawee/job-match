import { ConversationDetailSchema, ConversationSchema } from '@job-match/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  appendMessage,
  listConversations,
  listMessages,
  startConversation,
} from '../src/conversations/conversations.service';
import { messages } from '../src/conversations/conversations.tables';
import { TEST_DATABASE_URL, useTestDb } from './helpers';

const text = (value: string) => [{ type: 'text' as const, text: value }];

describe.skipIf(!TEST_DATABASE_URL)('conversations', () => {
  const { db, app, signIn } = useTestDb();

  it('names a new conversation after the first message on one line', async () => {
    const anna = await signIn();

    const conversation = await startConversation(
      db,
      anna.id,
      `  Wie schreibe\n\nich ${'x'.repeat(80)}`,
    );

    expect(conversation.title).toMatch(/^Wie schreibe ich x+$/);
    expect(conversation.title).toHaveLength(60);
  });

  it('lists only the own conversations, newest activity first', async () => {
    const anna = await signIn();
    const ben = await signIn();
    const first = await startConversation(db, anna.id, 'Erstes');
    const second = await startConversation(db, anna.id, 'Zweites');
    await appendMessage(db, anna.id, first.id, { role: 'user', content: text('Hallo') });

    const own = await listConversations(db, anna.id);

    expect(own.map((conversation) => conversation.id)).toEqual([first.id, second.id]);
    await expect(listConversations(db, ben.id)).resolves.toEqual([]);
  });

  it('answers 404 for the conversation of another user on every method', async () => {
    const anna = await signIn();
    const ben = await signIn();
    const conversation = await startConversation(db, anna.id, 'Privat');
    const url = `/api/conversations/${conversation.id}`;

    expect((await request(app).get(url).set(ben.headers)).status).toBe(404);
    expect((await request(app).patch(url).set(ben.headers).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete(url).set(ben.headers)).status).toBe(404);
    expect((await request(app).get('/api/conversations/kein-uuid').set(ben.headers)).status).toBe(
      404,
    );
    await expect(listMessages(db, ben.id, conversation.id)).resolves.toEqual([]);
    const own = await request(app).get(url).set(anna.headers);
    expect(ConversationDetailSchema.parse(own.body).id).toBe(conversation.id);
  });

  it('renames, rejects an empty title and deletes with all messages', async () => {
    const anna = await signIn();
    const conversation = await startConversation(db, anna.id, 'Alt');
    await appendMessage(db, anna.id, conversation.id, { role: 'user', content: text('x') });
    const url = `/api/conversations/${conversation.id}`;

    const renamed = await request(app).patch(url).set(anna.headers).send({ title: '  Neu  ' });
    const empty = await request(app).patch(url).set(anna.headers).send({ title: '   ' });
    const deleted = await request(app).delete(url).set(anna.headers);

    expect(ConversationSchema.parse(renamed.body).title).toBe('Neu');
    expect(empty.status).toBe(400);
    expect(deleted.status).toBe(204);
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));
    expect(rows).toHaveLength(0);
  });

  it('returns the last messages oldest first when a limit is set', async () => {
    const anna = await signIn();
    const conversation = await startConversation(db, anna.id, 'Lang');
    for (const word of ['eins', 'zwei', 'drei', 'vier']) {
      await appendMessage(db, anna.id, conversation.id, { role: 'user', content: text(word) });
    }

    const last = await listMessages(db, anna.id, conversation.id, 2);

    expect(last.map((message) => message.content)).toEqual([text('drei'), text('vier')]);
  });
});
