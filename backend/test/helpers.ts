import { pino } from 'pino';
import type { Logger } from 'pino';

import type { HealthService } from '../src/health/health.service';

/** Logger, der nichts schreibt – Tests prüfen Verhalten, nicht Log-Ausgaben. */
export function silentLogger(): Logger {
  return pino({ level: 'silent' });
}

/** Health-Service mit festem Ergebnis, für Router-Tests ohne Datenbank. */
export function fakeHealthService(databaseOk: boolean): HealthService {
  return { check: () => Promise.resolve({ databaseOk }) };
}

/** Minimale gültige Umgebung; einzelne Tests überschreiben gezielt einen Wert. */
export const VALID_ENV = {
  ANTHROPIC_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
} as const;
