import { sql } from 'drizzle-orm';

import type { Db } from '../db';

/** Was der Service vom Datenzugriff braucht – Tests setzen hier einen Fake ein. */
export interface HealthRepository {
  /** Wirft, wenn die Datenbank nicht antwortet. */
  ping(): Promise<void>;
}

/** Prüft die Verbindung mit der billigsten möglichen Abfrage. */
export function createDrizzleHealthRepository(db: Db): HealthRepository {
  return {
    async ping() {
      await db.execute(sql`select 1`);
    },
  };
}
