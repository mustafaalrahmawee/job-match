import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';

import { errorHandler, notFoundHandler } from './errors';
import { createHealthRouter } from './health/health.router';
import type { HealthService } from './health/health.service';

/** Alles, was die App von außen bekommt. `index.ts` übergibt echte Objekte, Tests Fakes. */
export interface AppDeps {
  readonly logger: Logger;
  readonly healthService: HealthService;
}

/** Baut die Express-App, ohne sie zu starten – so lässt sie sich mit supertest testen. */
export function createApp(deps: AppDeps): Express {
  const app = express();
  // Kein `X-Powered-By: Express` – verrät nur unnötig die Technik.
  app.disable('x-powered-by');

  // Ein Log-Eintrag je Anfrage (Methode, Pfad, Status, Dauer) – ohne Bodies.
  app.use(pinoHttp({ logger: deps.logger }));
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.use(createHealthRouter({ service: deps.healthService }));
  api.use(notFoundHandler);

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
