import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { expect, it } from 'vitest';

import { errorHandler } from '../src/errors';
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
