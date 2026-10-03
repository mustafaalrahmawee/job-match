import type Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import type { Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import { createAuthRouter } from './auth/auth.router';
import { createChatRouter } from './chat/chat.router';
import type { Config } from './config';
import { createConversationsRouter } from './conversations/conversations.router';
import type { Db } from './db';
import { errorHandler, notFoundHandler } from './errors';

export interface AppDeps {
  readonly db: Db;
  readonly llm: Anthropic;
  readonly logger: Logger;
  readonly config: Config;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger: deps.logger }));
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use(createAuthRouter(deps.db));
  api.use(createConversationsRouter(deps.db));
  api.use(createChatRouter(deps));
  api.use(notFoundHandler);

  app.use('/api', api);
  app.use(errorHandler);
  return app;
}
