import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { defineConfig } from 'vitest/config';

// Bewusst ohne Import aus src/: Vite will in Konfigurationsdateien nur Importe mit Endung.
const ROOT_ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));

/**
 * Tests bekommen aus der .env im Repo-Root nur Variablen mit `TEST_`-Präfix (z. B.
 * TEST_DATABASE_URL) – so hängen sie nie an API-Key oder Entwicklungsdatenbank. Echte
 * Umgebungsvariablen (z. B. in CI) gehen ohnehin durch.
 */
function testEnvFromFile(): Record<string, string> {
  if (!existsSync(ROOT_ENV_FILE)) return {};
  const entries = Object.entries(parseEnv(readFileSync(ROOT_ENV_FILE, 'utf8')));
  return Object.fromEntries(
    entries.filter((entry): entry is [string, string] => entry[0].startsWith('TEST_')),
  );
}

export default defineConfig(({ mode }) => ({
  test: {
    include: mode === 'integration' ? ['test/integration/*.test.ts'] : ['test/*.test.ts'],
    testTimeout: mode === 'integration' ? 120_000 : 5_000,
    env: testEnvFromFile(),
  },
}));
