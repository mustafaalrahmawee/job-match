import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

import { ROOT_ENV_FILE } from './src/config';

// drizzle-kit braucht nur die DB-URL, nicht die ganze App-Konfiguration (kein API-Key nötig).
if (existsSync(ROOT_ENV_FILE)) {
  process.loadEnvFile(ROOT_ENV_FILE);
}
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL fehlt – bitte .env anhand von .env.example anlegen.');
}

export default defineConfig({
  dialect: 'postgresql',
  // Sammelt die `<domäne>.tables.ts` aller Domänen (docs/STACK.md §3.1).
  schema: './src/schema.ts',
  out: './drizzle',
  // camelCase im Code, snake_case in der Datenbank.
  casing: 'snake_case',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
