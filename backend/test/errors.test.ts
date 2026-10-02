import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError, errorHandler, notFoundHandler } from '../src/errors';
import { silentLogger } from './helpers';

/** Kleine App, deren Routen gezielt Fehler werfen. */
function appThatThrows(error: unknown) {
  const app = express();
  app.use(pinoHttp({ logger: silentLogger() }));
  app.get('/boom', () => {
    throw error;
  });
  app.get('/async-boom', async () => {
    await Promise.resolve();
    throw error;
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('uses status and code of an AppError', async () => {
    const app = appThatThrows(new AppError(409, 'conflict', 'Schon vorhanden.'));

    const response = await request(app).get('/boom');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'conflict', message: 'Schon vorhanden.' } });
  });

  it('turns a ZodError into 400', async () => {
    const zodError = z.object({ name: z.string() }).safeParse({}).error;
    const app = appThatThrows(zodError);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'invalid_request' } });
  });

  it('hides the text of unexpected errors, also from async handlers', async () => {
    const app = appThatThrows(new Error('password=geheim'));

    const response = await request(app).get('/async-boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'internal', message: 'Es ist ein Fehler aufgetreten.' },
    });
  });
});

it('notFoundHandler answers unknown routes with JSON 404', async () => {
  const response = await request(appThatThrows(new Error())).get('/gibt-es-nicht');

  expect(response.status).toBe(404);
  expect(response.body).toMatchObject({ error: { code: 'not_found' } });
});
