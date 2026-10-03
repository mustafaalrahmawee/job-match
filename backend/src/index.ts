import { createApp } from './app';
import { loadConfig } from './config';
import { createDatabase } from './db';
import { createLlmClient } from './llm/client';
import { createLogger } from './logger';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const db = createDatabase(config.databaseUrl);
const app = createApp({ db, llm: createLlmClient(config), logger, config });

app.listen(config.port, (error) => {
  if (error) {
    logger.fatal({ err: error, port: config.port }, 'Backend konnte nicht starten');
    process.exit(1);
  }
  logger.info({ port: config.port }, 'Backend gestartet');
});
