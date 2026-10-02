import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';

import type { LogLevel } from './config';

/**
 * Felder, die nie im Log stehen dürfen (Tokens, Passwörter, Inhalte). Die App loggt Bodies gar
 * nicht erst – das hier ist die zweite Sicherung, falls später jemand `logger.info({ body })`
 * schreibt. Logs enthalten nur IDs, Längen, Tokenzahlen und Dauer (docs/STACK.md §4).
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'content',
  '*.password',
  '*.content',
];

export function createLogger(level: LogLevel, destination?: DestinationStream): Logger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: '[entfernt]' } }, destination);
}
