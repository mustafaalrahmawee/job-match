import type Anthropic from '@anthropic-ai/sdk';
import type { StopReason } from '@anthropic-ai/sdk/resources/messages';
import type { MessageBatchResult } from '@anthropic-ai/sdk/resources/messages/batches';
import { CvSchema, ErrorResponseSchema } from '@job-match/shared';
import type { CvAnalysis } from '@job-match/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CV_ANALYSIS_SYSTEM_PROMPT,
  buildCvAnalysisRequest,
  readAnalysis,
} from '../src/profile/profile.prompts';
import { failAnalysis, saveAnalysis, uploadCv } from '../src/profile/profile.service';
import { parseConfig } from '../src/config';
import { ZAI_BASE_URL } from '../src/llm/models';
import { cvVersions } from '../src/profile/profile.tables';
import { TEST_DATABASE_URL, VALID_ENV, useTestDb } from './helpers';

const ANALYSIS: CvAnalysis = {
  isCv: true,
  language: 'de',
  headline: 'Backend-Entwicklerin mit Node.js.',
  skills: ['Node.js'],
  degrees: [],
  languages: [{ language: 'Deutsch', level: 'Muttersprache' }],
  stations: [{ title: 'Entwicklerin', company: 'Beispiel GmbH', from: '2022', to: 'heute' }],
  strengths: ['Klarer Schwerpunkt'],
  improvements: ['Ergebnisse mit Zahlen belegen'],
  suggestedRole: 'backend',
  roleExplanation: 'Alle Stationen betreffen das Backend.',
};

const USAGE = {
  input_tokens: 100,
  output_tokens: 50,
  cache_read_input_tokens: 30,
  cache_creation_input_tokens: null,
};

function answer(text: string, stopReason: StopReason = 'end_turn') {
  return { stop_reason: stopReason, content: [{ type: 'text' as const, text, citations: null }] };
}

describe('buildCvAnalysisRequest', () => {
  it('asks Claude Sonnet with low effort for the schema and sends the pdf first', () => {
    const request = buildCvAnalysisRequest('UERG', 8000);

    expect(request).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 8000,
      output_config: { effort: 'low', format: { type: 'json_schema' } },
      system: CV_ANALYSIS_SYSTEM_PROMPT,
    });
    expect(request.messages[0]?.content[0]).toMatchObject({
      type: 'document',
      source: { media_type: 'application/pdf', data: 'UERG' },
    });
  });

  it('the analysis prompt follows the prompt rules', () => {
    expect(CV_ANALYSIS_SYSTEM_PROMPT.startsWith('Dies ist ein Lebenslauf')).toBe(true);
    expect(CV_ANALYSIS_SYSTEM_PROMPT).not.toMatch(/\b(AP|RP)-\d+/);
    expect(CV_ANALYSIS_SYSTEM_PROMPT).not.toMatch(/du bist|you are|act as/i);
    expect(CV_ANALYSIS_SYSTEM_PROMPT).not.toMatch(/\b(nie|niemals|immer|never|always)\b/i);
  });
});

describe('readAnalysis', () => {
  it('returns a valid analysis', () => {
    expect(readAnalysis(answer(JSON.stringify(ANALYSIS)))).toEqual({
      ok: true,
      analysis: ANALYSIS,
    });
  });

  it('shortens long lists instead of rejecting the analysis', () => {
    const long = {
      ...ANALYSIS,
      skills: Array.from({ length: 40 }, (_, index) => `Skill ${index}`),
      strengths: Array.from({ length: 8 }, (_, index) => `Stärke ${index}`),
    };

    const result = readAnalysis(answer(JSON.stringify(long)));

    expect(result.ok && result.analysis.skills).toHaveLength(30);
    expect(result.ok && result.analysis.strengths).toHaveLength(5);
  });

  it('never trusts a cut off answer', () => {
    const cut = JSON.stringify(ANALYSIS).slice(0, 80);

    expect(readAnalysis(answer(cut, 'max_tokens'))).toEqual({
      ok: false,
      error: 'analysis_truncated',
    });
    expect(readAnalysis(answer(JSON.stringify(ANALYSIS), 'max_tokens'))).toEqual({
      ok: false,
      error: 'analysis_truncated',
    });
  });

  it('maps refusal and a too long document to their own errors', () => {
    expect(readAnalysis(answer('', 'refusal'))).toEqual({ ok: false, error: 'refused' });
    expect(readAnalysis(answer('', 'model_context_window_exceeded'))).toEqual({
      ok: false,
      error: 'pdf_too_long',
    });
  });

  it('rejects text that is no json or misses a field', () => {
    const missing: Partial<CvAnalysis> = { ...ANALYSIS };
    delete missing.suggestedRole;

    expect(readAnalysis(answer('Hier ist die Analyse: …'))).toEqual({
      ok: false,
      error: 'invalid_analysis',
    });
    expect(readAnalysis(answer(JSON.stringify(missing)))).toEqual({
      ok: false,
      error: 'invalid_analysis',
    });
    expect(
      readAnalysis(answer(JSON.stringify({ ...ANALYSIS, suggestedRole: 'astronaut' }))),
    ).toEqual({ ok: false, error: 'invalid_analysis' });
  });

  it('reports a document that is not a cv', () => {
    expect(readAnalysis(answer(JSON.stringify({ ...ANALYSIS, isCv: false })))).toEqual({
      ok: false,
      error: 'not_a_cv',
    });
  });
});

describe.skipIf(!TEST_DATABASE_URL)('storing an analysis', () => {
  const { db, signIn } = useTestDb();
  const PDF = Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1');

  async function runningCv(userId: string) {
    const cv = await uploadCv(db, userId, { pdf: PDF, fileName: null });
    await db.update(cvVersions).set({ analysisStatus: 'running' }).where(eq(cvVersions.id, cv.id));
    return cv.id;
  }

  async function row(id: string) {
    const [cv] = await db.select().from(cvVersions).where(eq(cvVersions.id, id));
    return cv;
  }

  it('saves the analysis and the tokens of a running version', async () => {
    const anna = await signIn();
    const id = await runningCv(anna.id);

    expect(await saveAnalysis(db, anna.id, id, ANALYSIS, USAGE)).toBe(true);
    expect(await row(id)).toMatchObject({
      analysis: ANALYSIS,
      analysisStatus: 'done',
      analysisError: null,
      analysisInputTokens: 100,
      analysisOutputTokens: 50,
      analysisCacheReadTokens: 30,
      analysisCacheWriteTokens: 0,
    });
  });

  it('marks a running version as failed with its error code', async () => {
    const anna = await signIn();
    const id = await runningCv(anna.id);

    expect(await failAnalysis(db, anna.id, id, 'not_a_cv', USAGE)).toBe(true);
    expect(await row(id)).toMatchObject({
      analysis: null,
      analysisStatus: 'failed',
      analysisError: 'not_a_cv',
    });
  });

  it('changes nothing when the version is not running or belongs to someone else', async () => {
    const anna = await signIn();
    const ben = await signIn();
    const idle = (await uploadCv(db, anna.id, { pdf: PDF, fileName: null })).id;
    const running = await runningCv(anna.id);

    expect(await saveAnalysis(db, anna.id, idle, ANALYSIS, USAGE)).toBe(false);
    expect(await saveAnalysis(db, ben.id, running, ANALYSIS, USAGE)).toBe(false);
    expect(await failAnalysis(db, anna.id, crypto.randomUUID(), 'refused')).toBe(false);
    expect((await row(idle))?.analysisStatus).toBe('none');
    expect((await row(running))?.analysisStatus).toBe('running');
  });
});

function mockBatches() {
  const create = vi.fn();
  const retrieve = vi.fn();
  const results = vi.fn();
  const llm = { messages: { batches: { create, retrieve, results } } } as unknown as Anthropic;
  return { llm, create, retrieve, results };
}

function succeeded(text: string, stopReason: StopReason = 'end_turn', outputTokens = 900) {
  return {
    type: 'succeeded',
    message: {
      model: 'claude-sonnet-5-5',
      stop_reason: stopReason,
      content: [{ type: 'text', text, citations: null }],
      usage: {
        input_tokens: 4000,
        output_tokens: outputTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
  } as unknown as MessageBatchResult;
}

describe.skipIf(!TEST_DATABASE_URL)('analysis as message batch', () => {
  const batches = mockBatches();
  const { app, signIn } = useTestDb({ llm: batches.llm });
  const PDF = Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1');

  beforeEach(() => {
    vi.resetAllMocks();
    batches.create.mockImplementation(() =>
      Promise.resolve({ id: `batch_${crypto.randomUUID()}` }),
    );
    batches.retrieve.mockResolvedValue({ processing_status: 'in_progress' });
  });

  async function uploaded(headers: Record<string, string>) {
    const response = await request(app)
      .post('/api/cvs')
      .set(headers)
      .set('Content-Type', 'application/pdf')
      .send(PDF);
    return CvSchema.parse(response.body).id;
  }

  async function cvs(headers: Record<string, string>) {
    return (await request(app).get('/api/cvs').set(headers)).body as unknown[];
  }

  function finish(id: string, result: MessageBatchResult) {
    batches.retrieve.mockResolvedValue({ processing_status: 'ended' });
    batches.results.mockImplementation(() =>
      Promise.resolve(
        (function* () {
          yield { custom_id: 'someone-else', result: { type: 'expired' } };
          yield { custom_id: id, result };
        })(),
      ),
    );
  }

  it('sends one request for the version as batch and marks it as running', async () => {
    const anna = await signIn();
    const id = await uploaded(anna.headers);

    const response = await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);

    expect(CvSchema.parse(response.body)).toMatchObject({ analysisStatus: 'running' });
    const { requests } = batches.create.mock.calls[0]?.[0] as {
      requests: { custom_id: string; params: ReturnType<typeof buildCvAnalysisRequest> }[];
    };
    expect(requests).toHaveLength(1);
    expect(requests[0]?.custom_id).toBe(id);
    expect(requests[0]?.params.messages[0]?.content[0]).toMatchObject({
      source: { data: PDF.toString('base64') },
    });
  });

  it('starts only once and answers 404 for a foreign version', async () => {
    const anna = await signIn();
    const ben = await signIn();
    const id = await uploaded(anna.headers);

    await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);
    const again = await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);
    const foreign = await request(app).post(`/api/cvs/${id}/analysis`).set(ben.headers);

    expect(again.status).toBe(409);
    expect(foreign.status).toBe(404);
    expect(batches.create).toHaveBeenCalledOnce();
  });

  it('stays running while the batch is in progress and saves the result when it ended', async () => {
    const anna = await signIn();
    const id = await uploaded(anna.headers);
    await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);

    expect(await cvs(anna.headers)).toMatchObject([{ analysisStatus: 'running' }]);
    expect(batches.results).not.toHaveBeenCalled();

    finish(id, succeeded(JSON.stringify(ANALYSIS)));

    expect(await cvs(anna.headers)).toMatchObject([
      { analysisStatus: 'done', analysis: ANALYSIS, analysisError: null },
    ]);
  });

  it('retries a cut off answer once with more tokens, then gives up', async () => {
    const anna = await signIn();
    const id = await uploaded(anna.headers);
    await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);

    finish(id, succeeded('{"isCv": tr', 'max_tokens', 16_000));
    expect(await cvs(anna.headers)).toMatchObject([{ analysisStatus: 'running' }]);
    expect(batches.create).toHaveBeenCalledTimes(2);
    const retry = batches.create.mock.calls[1]?.[0] as {
      requests: { params: { max_tokens: number } }[];
    };
    expect(retry.requests[0]?.params.max_tokens).toBe(32_000);

    finish(id, succeeded('{"isCv": tr', 'max_tokens', 32_000));
    expect(await cvs(anna.headers)).toMatchObject([
      { analysisStatus: 'failed', analysisError: 'analysis_truncated' },
    ]);
    expect(batches.create).toHaveBeenCalledTimes(2);
  });

  it('maps failed batch results to their own error codes', async () => {
    const anna = await signIn();
    const notCv = await uploaded(anna.headers);
    await request(app).post(`/api/cvs/${notCv}/analysis`).set(anna.headers);
    finish(notCv, succeeded(JSON.stringify({ ...ANALYSIS, isCv: false })));
    await cvs(anna.headers);

    const errored = await uploaded(anna.headers);
    await request(app).post(`/api/cvs/${errored}/analysis`).set(anna.headers);
    finish(errored, { type: 'errored' } as unknown as MessageBatchResult);
    await cvs(anna.headers);

    const expired = await uploaded(anna.headers);
    await request(app).post(`/api/cvs/${expired}/analysis`).set(anna.headers);
    finish(expired, { type: 'expired' });

    const list = (await cvs(anna.headers)) as { id: string; analysisError: string | null }[];
    const errorOf = (id: string) => list.find((cv) => cv.id === id)?.analysisError;
    expect(errorOf(notCv)).toBe('not_a_cv');
    expect(errorOf(errored)).toBe('batch_failed');
    expect(errorOf(expired)).toBe('batch_expired');
  });

  it('keeps the list working when asking for the batch fails', async () => {
    const anna = await signIn();
    const id = await uploaded(anna.headers);
    await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);
    batches.retrieve.mockRejectedValue(new Error('Netz weg'));

    const response = await request(app).get('/api/cvs').set(anna.headers);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([{ analysisStatus: 'running' }]);
  });

  it('marks the version as failed when the batch cannot be created', async () => {
    const anna = await signIn();
    const id = await uploaded(anna.headers);
    batches.create.mockRejectedValue(new Error('Netz weg'));

    const response = await request(app).post(`/api/cvs/${id}/analysis`).set(anna.headers);

    expect(response.status).toBe(502);
    expect(await cvs(anna.headers)).toMatchObject([
      { analysisStatus: 'failed', analysisError: 'batch_failed' },
    ]);
  });
});

describe.skipIf(!TEST_DATABASE_URL)('analysis without claude', () => {
  const config = parseConfig({ ...VALID_ENV, ANTHROPIC_BASE_URL: ZAI_BASE_URL });
  const { app, signIn } = useTestDb({ config });

  it('answers 503 instead of sending the cv elsewhere', async () => {
    const anna = await signIn();
    const upload = await request(app)
      .post('/api/cvs')
      .set(anna.headers)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4\n', 'latin1'));

    const response = await request(app)
      .post(`/api/cvs/${CvSchema.parse(upload.body).id}/analysis`)
      .set(anna.headers);

    expect(response.status).toBe(503);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('analysis_unavailable');
  });
});
