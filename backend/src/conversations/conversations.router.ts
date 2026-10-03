import { RenameConversationSchema } from '@job-match/shared';
import { Router } from 'express';
import { z } from 'zod';

import { getAuth, requireAuth } from '../auth/auth.router';
import type { Db } from '../db';
import {
  ConversationNotFoundError,
  getConversation,
  listConversations,
  removeConversation,
  renameConversation,
} from './conversations.service';

function parseId(value: unknown): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw new ConversationNotFoundError();
  return result.data;
}

export function createConversationsRouter(db: Db): Router {
  const router = Router();
  router.use('/conversations', requireAuth(db));

  router.get('/conversations', async (_req, res) => {
    res.json(await listConversations(db, getAuth(res).user.id));
  });

  router.get('/conversations/:id', async (req, res) => {
    res.json(await getConversation(db, getAuth(res).user.id, parseId(req.params.id)));
  });

  router.patch('/conversations/:id', async (req, res) => {
    const { title } = RenameConversationSchema.parse(req.body);
    res.json(await renameConversation(db, getAuth(res).user.id, parseId(req.params.id), title));
  });

  router.delete('/conversations/:id', async (req, res) => {
    await removeConversation(db, getAuth(res).user.id, parseId(req.params.id));
    res.status(204).end();
  });

  return router;
}
