import { describe, expect, it } from 'vitest';

import { createHealthService } from '../src/health/health.service';
import { silentLogger } from './helpers';

describe('health service', () => {
  it('reports ok when the database answers', async () => {
    const service = createHealthService({
      repository: { ping: () => Promise.resolve() },
      logger: silentLogger(),
    });

    await expect(service.check()).resolves.toEqual({ databaseOk: true });
  });

  it('reports a missing database as state instead of throwing', async () => {
    const service = createHealthService({
      repository: { ping: () => Promise.reject(new Error('connection refused')) },
      logger: silentLogger(),
    });

    await expect(service.check()).resolves.toEqual({ databaseOk: false });
  });
});
