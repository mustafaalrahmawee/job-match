import { existsSync } from 'node:fs';

import { defineConfig } from 'drizzle-kit';

import { ROOT_ENV_FILE } from './src/config';

if (existsSync(ROOT_ENV_FILE)) {
  process.loadEnvFile(ROOT_ENV_FILE);
}
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL fehlt – bitte .env anhand von .env.example anlegen.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/**/*.tables.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
