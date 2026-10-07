import type { AnalysisError, AnalysisStatus, CvAnalysis, Role } from '@job-match/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
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
    analysis: jsonb().$type<CvAnalysis>(),
    analysisStatus: text().$type<AnalysisStatus>().notNull().default('none'),
    analysisError: text().$type<AnalysisError>(),
    analysisBatchId: text(),
    analysisStartedAt: timestamp({ withTimezone: true }),
    analysisInputTokens: integer(),
    analysisOutputTokens: integer(),
    analysisCacheReadTokens: integer(),
    analysisCacheWriteTokens: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cv_versions_user_id_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('cv_versions_one_active_idx')
      .on(table.userId)
      .where(sql`${table.active}`),
  ],
);
