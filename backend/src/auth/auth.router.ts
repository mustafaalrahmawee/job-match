import { LoginRequestSchema } from '@job-match/shared';
import type { User } from '@job-match/shared';
import { Router } from 'express';
import type { RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import type { Db } from '../db';
import { UnauthorizedError, authenticate, login, logout } from './auth.service';

export function requireAuth(db: Db): RequestHandler {
  return async (req, res, next) => {
    const token = /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')?.[1];
    if (!token) throw new UnauthorizedError();
    res.locals.user = await authenticate(db, token);
    res.locals.token = token;
    next();
  };
}

export function getAuth(res: Response): { user: User; token: string } {
  return { user: res.locals.user as User, token: res.locals.token as string };
}

export function createAuthRouter(db: Db): Router {
  const router = Router();

  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: {
      error: {
        code: 'too_many_requests',
        message: 'Zu viele Versuche. Bitte warte einige Minuten.',
      },
    },
  });

  router.post('/auth/login', loginLimit, async (req, res) => {
    res.json(await login(db, LoginRequestSchema.parse(req.body)));
  });

  router.post('/auth/logout', requireAuth(db), async (_req, res) => {
    await logout(db, getAuth(res).token);
    res.status(204).end();
  });

  router.get('/auth/me', requireAuth(db), (_req, res) => {
    res.json(getAuth(res).user);
  });

  return router;
}
