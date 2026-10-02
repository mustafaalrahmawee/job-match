import type { Logger } from 'pino';

import type { HealthRepository } from './health.repository';

/** Ergebnis der Prüfung; `databaseOk` entscheidet im Router über den HTTP-Status. */
export interface HealthStatus {
  readonly databaseOk: boolean;
}

export interface HealthService {
  check(): Promise<HealthStatus>;
}

export function createHealthService(deps: {
  repository: HealthRepository;
  logger: Logger;
}): HealthService {
  return {
    async check() {
      // Eine fehlende Datenbank ist kein Programmfehler, sondern ein Betriebszustand – deshalb
      // wird der Fehler hier abgefangen und als Zustand zurückgegeben.
      try {
        await deps.repository.ping();
        return { databaseOk: true };
      } catch {
        // Nur die Tatsache wird geloggt; der Fehlertext kann Verbindungsdaten enthalten.
        deps.logger.warn('Datenbank antwortet nicht');
        return { databaseOk: false };
      }
    },
  };
}
