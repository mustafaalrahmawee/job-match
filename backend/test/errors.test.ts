import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { expect, it } from 'vitest';

import { errorHandler } from '../src/errors';
import { describeLlmError } from '../src/llm/errors';
import { silentLogger } from './helpers';

it('hides the text of unexpected errors from the client', async () => {
  const app = express();
  app.use(pinoHttp({ logger: silentLogger() }));
  app.get('/boom', async () => {
    await Promise.resolve();
    throw new Error('password=geheim');
  });
  app.use(errorHandler);

  const response = await request(app).get('/boom');

  expect(response.status).toBe(500);
  expect(response.body).toEqual({
    error: { code: 'internal', message: 'Es ist ein Fehler aufgetreten.' },
  });
});

it('maps provider errors to stable codes for the client', () => {
  const headers = new Headers();

  expect(
    describeLlmError(new Anthropic.AuthenticationError(401, undefined, 'x', headers)).code,
  ).toBe('llm_misconfigured');
  expect(describeLlmError(new Anthropic.BadRequestError(400, undefined, 'x', headers)).code).toBe(
    'llm_rejected',
  );
  expect(describeLlmError(new Anthropic.RateLimitError(429, undefined, 'x', headers)).code).toBe(
    'llm_unavailable',
  );
  expect(describeLlmError(new Error('x')).code).toBe('internal');
});
