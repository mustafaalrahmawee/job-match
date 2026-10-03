import type { ContentBlock, StoredStopReason } from '@job-match/shared';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from '../auth/auth.tables';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('conversations_user_id_updated_at_idx').on(table.userId, table.updatedAt)],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text().$type<'user' | 'assistant'>().notNull(),
    content: jsonb().$type<ContentBlock[]>().notNull(),
    stopReason: text().$type<StoredStopReason>(),
    model: text(),
    effort: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('messages_conversation_id_created_at_idx').on(table.conversationId, table.createdAt),
  ],
);
