import type { Role } from '@job-match/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';

import type { Db } from '../db';
import { AppError } from '../errors';
import { cvVersions } from './profile.tables';

export class CvNotFoundError extends AppError {
  constructor() {
    super(404, 'cv_not_found', 'Diesen Lebenslauf gibt es nicht.');
  }
}

export class NotAPdfError extends AppError {
  constructor() {
    super(415, 'not_a_pdf', 'Bitte lade eine PDF-Datei hoch.');
  }
}

const cvColumns = {
  id: cvVersions.id,
  fileName: cvVersions.fileName,
  role: cvVersions.role,
  active: cvVersions.active,
  sizeBytes: cvVersions.sizeBytes,
  createdAt: cvVersions.createdAt,
};

function owned(userId: string, id: string) {
  return and(eq(cvVersions.id, id), eq(cvVersions.userId, userId));
}

export function listCvs(db: Db, userId: string) {
  return db
    .select(cvColumns)
    .from(cvVersions)
    .where(eq(cvVersions.userId, userId))
    .orderBy(desc(cvVersions.createdAt));
}

export async function uploadCv(
  db: Db,
  userId: string,
  { pdf, fileName }: { pdf: Buffer; fileName: string | null },
) {
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new NotAPdfError();
  return db.transaction(async (tx) => {
    await tx.update(cvVersions).set({ active: false }).where(eq(cvVersions.userId, userId));
    const [cv] = await tx
      .insert(cvVersions)
      .values({ userId, pdf, fileName, sizeBytes: pdf.length })
      .returning(cvColumns);
    if (!cv) throw new Error('Lebenslauf konnte nicht gespeichert werden.');
    return cv;
  });
}

export async function getCvPdf(db: Db, userId: string, id: string) {
  const [cv] = await db.select({ pdf: cvVersions.pdf }).from(cvVersions).where(owned(userId, id));
  if (!cv) throw new CvNotFoundError();
  return cv.pdf;
}

export async function setCvRole(db: Db, userId: string, id: string, role: Role) {
  const [cv] = await db
    .update(cvVersions)
    .set({ role })
    .where(owned(userId, id))
    .returning(cvColumns);
  if (!cv) throw new CvNotFoundError();
  return cv;
}

export async function activateCv(db: Db, userId: string, id: string) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: cvVersions.id })
      .from(cvVersions)
      .where(owned(userId, id));
    if (!found) throw new CvNotFoundError();

    await tx.update(cvVersions).set({ active: false }).where(eq(cvVersions.userId, userId));
    const [cv] = await tx
      .update(cvVersions)
      .set({ active: true })
      .where(owned(userId, id))
      .returning(cvColumns);
    if (!cv) throw new CvNotFoundError();
    return cv;
  });
}

export async function removeCvs(db: Db, userId: string, ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids)];
  await db.transaction(async (tx) => {
    const rows = await tx
      .delete(cvVersions)
      .where(and(inArray(cvVersions.id, unique), eq(cvVersions.userId, userId)))
      .returning({ id: cvVersions.id });
    if (rows.length !== unique.length) throw new CvNotFoundError();
  });
}
