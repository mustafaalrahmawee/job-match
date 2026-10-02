import { HealthResponseSchema } from '@job-match/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { fakeHealthService, silentLogger } from './helpers';

describe('GET /api/health', () => {
  it('returns 200 when the database answers', async () => {
    const app = createApp({ logger: silentLogger(), healthService: fakeHealthService(true) });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(response.body)).toEqual({ status: 'ok', database: 'ok' });
  });

  it('returns 503 with the same body shape when the database is down', async () => {
    const app = createApp({ logger: silentLogger(), healthService: fakeHealthService(false) });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(HealthResponseSchema.parse(response.body)).toEqual({
      status: 'degraded',
      database: 'error',
    });
  });

  it('does not reveal the framework', async () => {
    const app = createApp({ logger: silentLogger(), healthService: fakeHealthService(true) });

    const response = await request(app).get('/api/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
