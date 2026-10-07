import type Anthropic from '@anthropic-ai/sdk';
import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches';
import type { Usage } from '@anthropic-ai/sdk/resources/messages';
import type { AnalysisError, CvAnalysis, Role } from '@job-match/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Logger } from 'pino';

import type { Config } from '../config';
import type { Db } from '../db';
import { AppError } from '../errors';
import { describeLlmError } from '../llm/errors';
import {
  CV_ANALYSIS_MAX_TOKENS,
  CV_ANALYSIS_MAX_TOKENS_CAP,
  buildCvAnalysisRequest,
  readAnalysis,
} from './profile.prompts';
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

export class AnalysisUnavailableError extends AppError {
  constructor() {
    super(503, 'analysis_unavailable', 'Die Lebenslauf-Analyse ist gerade nicht verfügbar.');
  }
}

export class AnalysisNotStartableError extends AppError {
  constructor() {
    super(
      409,
      'analysis_not_startable',
      'Für diese Fassung läuft schon eine Analyse oder sie ist bereits fertig.',
    );
  }
}

export interface ProfileDeps {
  readonly db: Db;
  readonly llm: Anthropic;
  readonly logger: Logger;
  readonly config: Config;
}

const cvColumns = {
  id: cvVersions.id,
  fileName: cvVersions.fileName,
  role: cvVersions.role,
  active: cvVersions.active,
  sizeBytes: cvVersions.sizeBytes,
  createdAt: cvVersions.createdAt,
  analysis: cvVersions.analysis,
  analysisStatus: cvVersions.analysisStatus,
  analysisError: cvVersions.analysisError,
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

export type AnalysisUsage = Pick<
  Usage,
  'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens'
>;

function usageColumns(usage: AnalysisUsage) {
  return {
    analysisInputTokens: usage.input_tokens,
    analysisOutputTokens: usage.output_tokens,
    analysisCacheReadTokens: usage.cache_read_input_tokens ?? 0,
    analysisCacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function running(userId: string, id: string) {
  return and(owned(userId, id), eq(cvVersions.analysisStatus, 'running'));
}

export async function saveAnalysis(
  db: Db,
  userId: string,
  id: string,
  analysis: CvAnalysis,
  usage: AnalysisUsage,
): Promise<boolean> {
  const rows = await db
    .update(cvVersions)
    .set({ analysis, analysisStatus: 'done', analysisError: null, ...usageColumns(usage) })
    .where(running(userId, id))
    .returning({ id: cvVersions.id });
  return rows.length > 0;
}

export async function failAnalysis(
  db: Db,
  userId: string,
  id: string,
  error: AnalysisError,
  usage?: AnalysisUsage,
): Promise<boolean> {
  const rows = await db
    .update(cvVersions)
    .set({ analysisStatus: 'failed', analysisError: error, ...(usage && usageColumns(usage)) })
    .where(running(userId, id))
    .returning({ id: cvVersions.id });
  return rows.length > 0;
}

const MINUTE_MS = 60_000;

async function sendToBatch(
  { db, llm }: ProfileDeps,
  userId: string,
  id: string,
  pdf: Buffer,
  maxTokens: number,
): Promise<void> {
  let batchId: string;
  try {
    const params = buildCvAnalysisRequest(pdf.toString('base64'), maxTokens);
    batchId = (await llm.messages.batches.create({ requests: [{ custom_id: id, params }] })).id;
  } catch (error) {
    await failAnalysis(db, userId, id, 'batch_failed');
    const info = describeLlmError(error);
    throw new AppError(502, info.code, info.message);
  }
  await db.update(cvVersions).set({ analysisBatchId: batchId }).where(running(userId, id));
}

export async function startAnalysis(deps: ProfileDeps, userId: string, id: string) {
  const { db, config } = deps;
  if (new URL(config.anthropicBaseUrl).host !== 'api.anthropic.com') {
    throw new AnalysisUnavailableError();
  }
  const [started] = await db
    .update(cvVersions)
    .set({
      analysisStatus: 'running',
      analysisError: null,
      analysisBatchId: null,
      analysisStartedAt: new Date(),
    })
    .where(and(owned(userId, id), inArray(cvVersions.analysisStatus, ['none', 'failed'])))
    .returning({ pdf: cvVersions.pdf });
  if (!started) {
    const [cv] = await db.select({ id: cvVersions.id }).from(cvVersions).where(owned(userId, id));
    throw cv ? new AnalysisNotStartableError() : new CvNotFoundError();
  }
  await sendToBatch(deps, userId, id, started.pdf, CV_ANALYSIS_MAX_TOKENS);
  const [cv] = await db.select(cvColumns).from(cvVersions).where(owned(userId, id));
  if (!cv) throw new CvNotFoundError();
  return cv;
}

async function findResult(llm: Anthropic, batchId: string, id: string) {
  for await (const entry of await llm.messages.batches.results(batchId)) {
    if (entry.custom_id === id) return entry.result;
  }
  return undefined;
}

async function handleResult(
  deps: ProfileDeps,
  userId: string,
  id: string,
  result: MessageBatchResult | undefined,
): Promise<void> {
  const { db, logger } = deps;
  if (result?.type !== 'succeeded') {
    logger.warn({ cvId: id, result: result?.type ?? 'missing' }, 'cv-analysis-batch-failed');
    const error =
      result?.type === 'expired' || result?.type === 'canceled' ? 'batch_expired' : 'batch_failed';
    await failAnalysis(db, userId, id, error);
    return;
  }
  const { message } = result;
  const analysis = readAnalysis(message);
  logger.info(
    {
      cvId: id,
      model: message.model,
      stopReason: message.stop_reason,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens,
      cacheWriteTokens: message.usage.cache_creation_input_tokens,
      error: analysis.ok ? undefined : analysis.error,
    },
    'cv-analysis',
  );
  if (analysis.ok) {
    await saveAnalysis(db, userId, id, analysis.analysis, message.usage);
  } else if (
    analysis.error === 'analysis_truncated' &&
    message.usage.output_tokens < CV_ANALYSIS_MAX_TOKENS_CAP
  ) {
    const maxTokens = Math.min(message.usage.output_tokens * 2, CV_ANALYSIS_MAX_TOKENS_CAP);
    await sendToBatch(deps, userId, id, await getCvPdf(db, userId, id), maxTokens);
  } else {
    await failAnalysis(db, userId, id, analysis.error, message.usage);
  }
}

async function collectAnalysis(
  deps: ProfileDeps,
  userId: string,
  cv: { id: string; batchId: string | null; startedAt: Date | null },
): Promise<void> {
  const age = Date.now() - (cv.startedAt?.getTime() ?? 0);
  if (!cv.batchId) {
    if (age > 10 * MINUTE_MS) await failAnalysis(deps.db, userId, cv.id, 'batch_failed');
    return;
  }
  const batch = await deps.llm.messages.batches.retrieve(cv.batchId);
  if (batch.processing_status !== 'ended') {
    if (age > 25 * 60 * MINUTE_MS) await failAnalysis(deps.db, userId, cv.id, 'batch_expired');
    return;
  }
  await handleResult(deps, userId, cv.id, await findResult(deps.llm, cv.batchId, cv.id));
}

export async function collectAnalyses(deps: ProfileDeps, userId: string): Promise<void> {
  const pending = await deps.db
    .select({
      id: cvVersions.id,
      batchId: cvVersions.analysisBatchId,
      startedAt: cvVersions.analysisStartedAt,
    })
    .from(cvVersions)
    .where(and(eq(cvVersions.userId, userId), eq(cvVersions.analysisStatus, 'running')));
  for (const cv of pending) {
    try {
      await collectAnalysis(deps, userId, cv);
    } catch (error) {
      deps.logger.warn({ cvId: cv.id, err: error }, 'cv-analysis-collect-failed');
    }
  }
}
