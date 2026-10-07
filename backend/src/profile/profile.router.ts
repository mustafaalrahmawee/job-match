import {
  CvFileNameSchema,
  DeleteCvsSchema,
  MAX_CV_BYTES,
  SetCvRoleSchema,
} from '@job-match/shared';
import express, { Router } from 'express';
import { z } from 'zod';

import { getAuth, requireAuth } from '../auth/auth.router';
import {
  activateCv,
  collectAnalyses,
  CvNotFoundError,
  getCvPdf,
  listCvs,
  NotAPdfError,
  removeCvs,
  setCvRole,
  startAnalysis,
  uploadCv,
} from './profile.service';
import type { ProfileDeps } from './profile.service';

function parseId(value: unknown): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw new CvNotFoundError();
  return result.data;
}

function toPdf(body: unknown): Buffer {
  if (!Buffer.isBuffer(body)) throw new NotAPdfError();
  return body;
}

function toFileName(header: string | undefined): string | null {
  if (header === undefined) return null;
  try {
    const result = CvFileNameSchema.safeParse(decodeURIComponent(header));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function createProfileRouter(deps: ProfileDeps): Router {
  const { db } = deps;
  const router = Router();
  router.use('/cvs', requireAuth(db));

  router.get('/cvs', async (_req, res) => {
    const userId = getAuth(res).user.id;
    await collectAnalyses(deps, userId);
    res.json(await listCvs(db, userId));
  });

  router.post(
    '/cvs',
    express.raw({ type: 'application/pdf', limit: MAX_CV_BYTES }),
    async (req, res) => {
      const upload = { pdf: toPdf(req.body), fileName: toFileName(req.get('X-File-Name')) };
      res.status(201).json(await uploadCv(db, getAuth(res).user.id, upload));
    },
  );

  router.get('/cvs/:id/pdf', async (req, res) => {
    const pdf = await getCvPdf(db, getAuth(res).user.id, parseId(req.params.id));
    res
      .type('application/pdf')
      .set('Content-Disposition', 'inline; filename="lebenslauf.pdf"')
      .send(pdf);
  });

  router.patch('/cvs/:id', async (req, res) => {
    const { role } = SetCvRoleSchema.parse(req.body);
    res.json(await setCvRole(db, getAuth(res).user.id, parseId(req.params.id), role));
  });

  router.post('/cvs/delete', async (req, res) => {
    const { ids } = DeleteCvsSchema.parse(req.body);
    await removeCvs(db, getAuth(res).user.id, ids);
    res.status(204).end();
  });

  router.post('/cvs/:id/analysis', async (req, res) => {
    res.json(await startAnalysis(deps, getAuth(res).user.id, parseId(req.params.id)));
  });

  router.post('/cvs/:id/activate', async (req, res) => {
    res.json(await activateCv(db, getAuth(res).user.id, parseId(req.params.id)));
  });

  return router;
}
