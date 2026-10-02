import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Konfiguration der App: einmal beim Start aus der Umgebung gelesen und mit Zod geprüft.
 * Ein Fehler soll den Start verhindern – nicht erst beim ersten Chat auffallen.
 */

/** Platzhalter aus .env.example: damit scheitert der Start sofort mit einer klaren Meldung. */
export const PLACEHOLDER_API_KEY = 'changeme';

/** Eine .env im Repo-Root für Backend, Skripte und drizzle-kit – unabhängig vom Arbeitsverzeichnis. */
export const ROOT_ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string()
    .min(1)
    .refine((key) => key !== PLACEHOLDER_API_KEY, {
      message: 'Platzhalter aus .env.example – bitte einen echten API-Key eintragen',
    }),
  ANTHROPIC_BASE_URL: z.url().default('https://api.anthropic.com'),
  // Thinking zählt gegen max_tokens – zu knapp, und Antworten brechen mitten im Satz ab.
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(16_000),
  // Gilt bis zum Beginn der Antwort; ein laufender Stream darf danach länger dauern.
  LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(60),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'muss mit postgresql:// oder postgres:// beginnen'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8000),
  LOG_LEVEL: z
    .string()
    .transform((level) => level.toLowerCase())
    .pipe(z.enum(LOG_LEVELS))
    .default('info'),
});

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Config {
  readonly anthropicApiKey: string;
  readonly anthropicBaseUrl: string;
  readonly llmMaxTokens: number;
  readonly llmTimeoutMs: number;
  readonly llmMaxRetries: number;
  readonly databaseUrl: string;
  readonly port: number;
  readonly logLevel: LogLevel;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/**
 * Prüft die Umgebung und liefert die Konfiguration. Die Umgebung kommt als Parameter, damit Tests
 * nicht an der .env des Entwicklungsrechners hängen. Jedes Problem steht einzeln in der Meldung.
 */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(
      `Ungültige Konfiguration – bitte .env anhand von .env.example prüfen:\n${details}`,
    );
  }
  const values = result.data;
  return {
    anthropicApiKey: values.ANTHROPIC_API_KEY,
    anthropicBaseUrl: values.ANTHROPIC_BASE_URL,
    llmMaxTokens: values.LLM_MAX_TOKENS,
    llmTimeoutMs: values.LLM_TIMEOUT_SECONDS * 1000,
    llmMaxRetries: values.LLM_MAX_RETRIES,
    databaseUrl: values.DATABASE_URL,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
  };
}

/**
 * Lädt die .env aus dem Repo-Root (falls vorhanden) in `process.env` und prüft sie.
 * Echte Umgebungsvariablen haben Vorrang – `process.loadEnvFile` überschreibt sie nicht.
 */
export function loadConfig(): Config {
  if (existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }
  return parseConfig(process.env);
}
