import type { HealthResponse } from '@job-match/shared';
import { Router } from 'express';

import type { HealthService } from './health.service';

export function createHealthRouter(deps: { service: HealthService }): Router {
  const router = Router();

  /**
   * Lebenszeichen für Deployment und Frontend. Ohne Datenbank ist die App nicht benutzbar, also
   * antwortet sie dann mit 503 – so merkt es ein Healthcheck von außen, ohne den Körper zu lesen.
   */
  router.get('/health', async (_req, res) => {
    const { databaseOk } = await deps.service.check();
    const body: HealthResponse = databaseOk
      ? { status: 'ok', database: 'ok' }
      : { status: 'degraded', database: 'error' };
    res.status(databaseOk ? 200 : 503).json(body);
  });

  return router;
}
