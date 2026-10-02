import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export interface Database {
  readonly db: Db;
  /** Schließt alle Verbindungen – beim Herunterfahren und am Ende von Repository-Tests. */
  close(): Promise<void>;
}

export function createDatabase(url: string): Database {
  const pool = new Pool({ connectionString: url });
  return {
    db: drizzle(pool, { schema, casing: 'snake_case' }),
    close: () => pool.end(),
  };
}
