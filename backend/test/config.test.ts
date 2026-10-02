import { describe, expect, it } from 'vitest';

import { ConfigError, parseConfig } from '../src/config';
import { VALID_ENV } from './helpers';

describe('parseConfig', () => {
  it('uses defaults for optional values', () => {
    const config = parseConfig(VALID_ENV);

    expect(config).toEqual({
      anthropicApiKey: 'test-key',
      anthropicBaseUrl: 'https://api.anthropic.com',
      llmMaxTokens: 16_000,
      llmTimeoutMs: 60_000,
      llmMaxRetries: 2,
      databaseUrl: VALID_ENV.DATABASE_URL,
      port: 8000,
      logLevel: 'info',
    });
  });

  it('converts strings to numbers and log level to lower case', () => {
    const config = parseConfig({
      ...VALID_ENV,
      LLM_MAX_TOKENS: '2000',
      LLM_TIMEOUT_SECONDS: '1.5',
      LLM_MAX_RETRIES: '0',
      PORT: '3000',
      LOG_LEVEL: 'DEBUG',
    });

    expect(config.llmMaxTokens).toBe(2000);
    expect(config.llmTimeoutMs).toBe(1500);
    expect(config.llmMaxRetries).toBe(0);
    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe('debug');
  });

  it('accepts the short postgres:// scheme', () => {
    const config = parseConfig({ ...VALID_ENV, DATABASE_URL: 'postgres://u:p@host/db' });

    expect(config.databaseUrl).toBe('postgres://u:p@host/db');
  });

  it('rejects the placeholder api key from .env.example', () => {
    expect(() => parseConfig({ ...VALID_ENV, ANTHROPIC_API_KEY: 'changeme' })).toThrow(
      /ANTHROPIC_API_KEY: Platzhalter/,
    );
  });

  it('lists every problem in one error', () => {
    const error = captureError(() =>
      parseConfig({ DATABASE_URL: 'mysql://x', LOG_LEVEL: 'verbose' }),
    );

    expect(error).toBeInstanceOf(ConfigError);
    expect(error.message).toContain('ANTHROPIC_API_KEY');
    expect(error.message).toContain('DATABASE_URL');
    expect(error.message).toContain('LOG_LEVEL');
  });

  it('rejects an invalid base url', () => {
    expect(() => parseConfig({ ...VALID_ENV, ANTHROPIC_BASE_URL: 'not a url' })).toThrow(
      /ANTHROPIC_BASE_URL/,
    );
  });
});

function captureError(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error('Es wurde kein Fehler geworfen.');
}
