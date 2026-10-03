import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const ROOT_ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

const EnvSchema = z
  .object({
    ANTHROPIC_API_KEY: z
      .string()
      .min(1)
      .refine((key) => key !== 'changeme', {
        message: 'Platzhalter aus .env.example – bitte einen echten API-Key eintragen',
      }),
    ANTHROPIC_BASE_URL: z.url().default('https://api.anthropic.com'),
    LLM_MAX_TOKENS: z.coerce.number().int().positive().default(16_000),
    LLM_TIMEOUT_SECONDS: z.coerce.number().positive().default(60),
    LLM_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'muss mit postgresql:// oder postgres:// beginnen'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8000),
    LOG_LEVEL: z
      .string()
      .transform((level) => level.toLowerCase())
      .pipe(z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']))
      .default('info'),
    CHAT_HISTORY_LIMIT: z.coerce.number().int().min(1).default(40),
  })
  .transform((env) => ({
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL,
    llmMaxTokens: env.LLM_MAX_TOKENS,
    llmTimeoutMs: env.LLM_TIMEOUT_SECONDS * 1000,
    llmMaxRetries: env.LLM_MAX_RETRIES,
    databaseUrl: env.DATABASE_URL,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    chatHistoryLimit: env.CHAT_HISTORY_LIMIT,
  }));

export type Config = z.infer<typeof EnvSchema>;

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = EnvSchema.safeParse(env);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Ungültige Konfiguration – bitte .env anhand von .env.example prüfen:\n${details}`,
  );
}

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV_FILE)) process.loadEnvFile(ROOT_ENV_FILE);
  try {
    return parseConfig(process.env);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
