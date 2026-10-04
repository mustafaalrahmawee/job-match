import Anthropic from '@anthropic-ai/sdk';
import type { ChatEvent } from '@job-match/shared';
import { inArray } from 'drizzle-orm';
import { pino } from 'pino';
import type { Logger } from 'pino';
import { afterAll } from 'vitest';

import { createApp } from '../src/app';
import type { AppDeps } from '../src/app';
import { login, setPassword } from '../src/auth/auth.service';
import { users } from '../src/auth/auth.tables';
import { parseConfig } from '../src/config';
import { createDatabase } from '../src/db';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const VALID_ENV = {
  ANTHROPIC_API_KEY: 'test-key',
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/db',
} as const;

export const PASSWORD = 'a-long-password';

export function parseEvents(body: string): ChatEvent[] {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.includes('data: '))
    .map((chunk) => JSON.parse(chunk.slice(chunk.indexOf('data: ') + 6)) as ChatEvent);
}

export function silentLogger(): Logger {
  return pino({ level: 'silent' });
}

export function useTestDb(deps: Partial<Pick<AppDeps, 'llm' | 'config'>> = {}) {
  const db = createDatabase(TEST_DATABASE_URL ?? VALID_ENV.DATABASE_URL);
  const emails: string[] = [];
  afterAll(async () => {
    if (emails.length > 0) await db.delete(users).where(inArray(users.email, emails));
    await db.$client.end();
  });

  const app = createApp({
    db,
    llm: deps.llm ?? new Anthropic({ apiKey: 'test-key' }),
    logger: silentLogger(),
    config: deps.config ?? parseConfig(VALID_ENV),
  });

  function newEmail(): string {
    const email = `test-${crypto.randomUUID()}@example.com`;
    emails.push(email);
    return email;
  }

  async function signIn() {
    const email = newEmail();
    await setPassword(db, email, PASSWORD);
    const auth = await login(db, { email, password: PASSWORD });
    return { id: auth.user.id, email, headers: { Authorization: `Bearer ${auth.token}` } };
  }

  return { db, app, newEmail, signIn };
}
