import { ContentBlockSchema, StoredStopReasonSchema } from '@job-match/shared';
import type {
  ContentBlock,
  Conversation,
  ConversationDetail,
  Message,
  MessageRole,
  StoredStopReason,
} from '@job-match/shared';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

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

const TITLE_MAX_LENGTH = 60;

export function titleFromMessage(message: string): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= TITLE_MAX_LENGTH) return oneLine;
  return `${oneLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function toConversation(row: typeof conversations.$inferSelect): Conversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessage(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    role: row.role,
    content: z.array(ContentBlockSchema).parse(row.content),
    stopReason: row.stopReason === null ? null : StoredStopReasonSchema.parse(row.stopReason),
    createdAt: row.createdAt.toISOString(),
  };
}

function owned(userId: string, id: string) {
  return and(eq(conversations.id, id), eq(conversations.userId, userId));
}

export async function listConversations(db: Db, userId: string): Promise<Conversation[]> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
  return rows.map(toConversation);
}

export async function assertOwned(db: Db, userId: string, id: string): Promise<Conversation> {
  const [row] = await db.select().from(conversations).where(owned(userId, id));
  if (!row) throw new ConversationNotFoundError();
  return toConversation(row);
}

export async function getConversation(
  db: Db,
  userId: string,
  id: string,
): Promise<ConversationDetail> {
  const conversation = await assertOwned(db, userId, id);
  return { ...conversation, messages: await listMessages(db, userId, id) };
}

export async function startConversation(
  db: Db,
  userId: string,
  firstMessage: string,
): Promise<Conversation> {
  const [row] = await db
    .insert(conversations)
    .values({ userId, title: titleFromMessage(firstMessage) })
    .returning();
  if (!row) throw new Error('Gespräch konnte nicht angelegt werden.');
  return toConversation(row);
}

export async function renameConversation(
  db: Db,
  userId: string,
  id: string,
  title: string,
): Promise<Conversation> {
  const [row] = await db.update(conversations).set({ title }).where(owned(userId, id)).returning();
  if (!row) throw new ConversationNotFoundError();
  return toConversation(row);
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
): Promise<Message> {
  return db.transaction(async (tx) => {
    const touched = await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(owned(userId, conversationId))
      .returning({ id: conversations.id });
    if (touched.length === 0) throw new ConversationNotFoundError();

    const [row] = await tx
      .insert(messages)
      .values({ conversationId, ...message })
      .returning();
    if (!row) throw new Error('Nachricht konnte nicht gespeichert werden.');
    return toMessage(row);
  });
}

export async function listMessages(
  db: Db,
  userId: string,
  conversationId: string,
  limit?: number,
): Promise<Message[]> {
  const query = db
    .select({ message: messages })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(messages.conversationId, conversationId), eq(conversations.userId, userId)));

  const rows =
    limit === undefined
      ? await query.orderBy(messages.createdAt)
      : (await query.orderBy(desc(messages.createdAt)).limit(limit)).reverse();
  return rows.map((row) => toMessage(row.message));
}
