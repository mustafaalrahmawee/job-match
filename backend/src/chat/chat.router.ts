import { ChatRequestSchema } from '@job-match/shared';
import type { ChatEvent } from '@job-match/shared';
import { Router } from 'express';
import type { Response } from 'express';

import { getAuth, requireAuth } from '../auth/auth.router';
import { startChat } from './chat.service';
import type { ChatDeps } from './chat.service';

function writeEvent(res: Response, event: ChatEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function createChatRouter(deps: ChatDeps): Router {
  const router = Router();

  router.post('/chat', requireAuth(deps.db), async (req, res) => {
    const request = ChatRequestSchema.parse(req.body);

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    const events = await startChat(deps, {
      userId: getAuth(res).user.id,
      request,
      signal: controller.signal,
    });

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    try {
      for await (const event of events) writeEvent(res, event);
    } catch (error) {
      req.log.error({ err: error }, 'Chat-Strom fehlgeschlagen');
      writeEvent(res, {
        type: 'error',
        code: 'internal',
        message: 'Es ist ein Fehler aufgetreten.',
      });
    }
    res.end();
  });

  return router;
}
