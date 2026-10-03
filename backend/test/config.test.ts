import { expect, it } from 'vitest';

import { parseConfig } from '../src/config';
import { VALID_ENV } from './helpers';

it('reads defaults and converts values', () => {
  const config = parseConfig({ ...VALID_ENV, LLM_TIMEOUT_SECONDS: '1.5', LOG_LEVEL: 'DEBUG' });

  expect(config).toMatchObject({
    anthropicBaseUrl: 'https://api.anthropic.com',
    llmTimeoutMs: 1500,
    logLevel: 'debug',
    chatHistoryLimit: 40,
  });
});

it('rejects the placeholder key and lists every problem', () => {
  expect(() => parseConfig({ ANTHROPIC_API_KEY: 'changeme', DATABASE_URL: 'mysql://x' })).toThrow(
    /ANTHROPIC_API_KEY: Platzhalter[\s\S]*DATABASE_URL/,
  );
});
