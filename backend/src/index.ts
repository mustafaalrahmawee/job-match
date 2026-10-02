import { createApp } from './app';
import { ConfigError, loadConfig } from './config';
import { createDatabase } from './db';
import { createDrizzleHealthRepository } from './health/health.repository';
import { createHealthService } from './health/health.service';
import { createLogger } from './logger';

/**
 * Startpunkt und einzige Stelle, die echte Objekte baut: Konfiguration, Logger, Datenbank,
 * Repositories und Services. Alles Weitere bekommt seine Abhängigkeiten als Parameter.
 */
function main(): void {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const database = createDatabase(config.databaseUrl);

  const healthService = createHealthService({
    repository: createDrizzleHealthRepository(database.db),
    logger,
  });

  const app = createApp({ logger, healthService });
  // Express 5 reicht Fehler beim Start (z. B. Port belegt) an den Callback weiter.
  const server = app.listen(config.port, (error) => {
    if (error) {
      logger.fatal({ err: error, port: config.port }, 'Backend konnte nicht starten');
      process.exit(1);
    }
    logger.info({ port: config.port }, 'Backend gestartet');
  });

  // Sauber herunterfahren: keine neuen Anfragen annehmen, dann die DB-Verbindungen schließen.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Backend wird beendet');
    server.close(() => {
      void database.close().then(() => process.exit(0));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

try {
  main();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
