import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-file-name"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  'content',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.content',
];

export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: '[entfernt]' } }, destination);
}
