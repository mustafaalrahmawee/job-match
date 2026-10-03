import type { ContentBlock, MessageRole, StoredStopReason } from '@job-match/shared';
import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../db';
import { AppError } from '../errors';
import { conversations, messages } from './conversations.tables';

export class ConversationNotFoundError extends AppError {
  constructor() {
    super(404, 'conversation_not_found', 'Dieses Gespräch gibt es nicht.');
  }
}

export interface NewMessage {
  readonly role: MessageRole;
  readonly content: ContentBlock[];
  readonly stopReason?: StoredStopReason;
  readonly model?: string;
  readonly effort?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

const conversationColumns = {
  id: conversations.id,
  title: conversations.title,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt,
};

const messageColumns = {
  id: messages.id,
  role: messages.role,
  content: messages.content,
  stopReason: messages.stopReason,
  createdAt: messages.createdAt,
};

function owned(userId: string, id: string) {
  return and(eq(conversations.id, id), eq(conversations.userId, userId));
}

export function listConversations(db: Db, userId: string) {
  return db
    .select(conversationColumns)
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function assertOwned(db: Db, userId: string, id: string) {
  const [conversation] = await db
    .select(conversationColumns)
    .from(conversations)
    .where(owned(userId, id));
  if (!conversation) throw new ConversationNotFoundError();
  return conversation;
}

export async function getConversation(db: Db, userId: string, id: string) {
  const conversation = await assertOwned(db, userId, id);
  return { ...conversation, messages: await listMessages(db, userId, id) };
}

export async function startConversation(db: Db, userId: string, firstMessage: string) {
  const title = firstMessage.replace(/\s+/g, ' ').trim().slice(0, 60);
  const [conversation] = await db
    .insert(conversations)
    .values({ userId, title })
    .returning(conversationColumns);
  if (!conversation) throw new Error('Gespräch konnte nicht angelegt werden.');
  return conversation;
}

export async function renameConversation(db: Db, userId: string, id: string, title: string) {
  const [conversation] = await db
    .update(conversations)
    .set({ title })
    .where(owned(userId, id))
    .returning(conversationColumns);
  if (!conversation) throw new ConversationNotFoundError();
  return conversation;
}

export async function removeConversation(db: Db, userId: string, id: string): Promise<void> {
  const rows = await db
    .delete(conversations)
    .where(owned(userId, id))
    .returning({ id: conversations.id });
  if (rows.length === 0) throw new ConversationNotFoundError();
}

export async function appendMessage(
  db: Db,
  userId: string,
  conversationId: string,
  message: NewMessage,
) {
  return db.transaction(async (tx) => {
    const touched = await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(owned(userId, conversationId))
      .returning({ id: conversations.id });
    if (touched.length === 0) throw new ConversationNotFoundError();

    const [saved] = await tx
      .insert(messages)
      .values({ conversationId, ...message })
      .returning(messageColumns);
    if (!saved) throw new Error('Nachricht konnte nicht gespeichert werden.');
    return saved;
  });
}

export async function listMessages(db: Db, userId: string, conversationId: string, limit?: number) {
  const query = db
    .select(messageColumns)
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(messages.conversationId, conversationId), eq(conversations.userId, userId)));

  return limit === undefined
    ? query.orderBy(messages.createdAt)
    : (await query.orderBy(desc(messages.createdAt)).limit(limit)).reverse();
}
