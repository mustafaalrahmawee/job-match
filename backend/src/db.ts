import { drizzle } from 'drizzle-orm/node-postgres';

export function createDatabase(url: string) {
  return drizzle(url, { casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDatabase>;
