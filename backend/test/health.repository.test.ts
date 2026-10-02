import { afterAll, describe, expect, it } from 'vitest';

import { createDatabase } from '../src/db';
import { createDrizzleHealthRepository } from '../src/health/health.repository';

// Repository-Tests laufen gegen eine echte Postgres-Test-Datenbank (docs/STACK.md §5). Ohne
// TEST_DATABASE_URL werden sie übersprungen – CI setzt die Variable immer.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('drizzle health repository', () => {
  const database = createDatabase(url ?? '');
  afterAll(() => database.close());

  it('pings the database', async () => {
    const repository = createDrizzleHealthRepository(database.db);

    await expect(repository.ping()).resolves.toBeUndefined();
  });
});

describe('drizzle health repository without database', () => {
  it('throws when the database does not answer', async () => {
    // Port 1 ist reserviert und nimmt keine Verbindungen an.
    const database = createDatabase('postgresql://user:pass@127.0.0.1:1/db');
    const repository = createDrizzleHealthRepository(database.db);

    await expect(repository.ping()).rejects.toThrow();
    await database.close();
  });
});
