import type { Role } from '@job-match/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from '../auth/auth.tables';

const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea',
});

export const cvVersions = pgTable(
  'cv_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pdf: bytea().notNull(),
    fileName: text(),
    sizeBytes: integer().notNull(),
    role: text().$type<Role>(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cv_versions_user_id_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('cv_versions_one_active_idx')
      .on(table.userId)
      .where(sql`${table.active}`),
  ],
);
