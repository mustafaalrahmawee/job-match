import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RoleSchema } from '@job-match/shared';
import { z } from 'zod';

const SUITE_DIR = fileURLToPath(new URL('.', import.meta.url));
const SAMPLES_DIR = join(SUITE_DIR, 'samples');

export const RUNS = [1, 2, 3] as const;

const GoldSchema = z.object({
  id: z.string(),
  group: z.enum(['typical', 'edge', 'hard']),
  focus: z.string(),
  isCv: z.boolean(),
  language: z.enum(['de', 'en']),
  role: RoleSchema.nullable(),
  stations: z.array(
    z.object({ title: z.string(), company: z.string(), from: z.string(), to: z.string() }),
  ),
  contact: z.array(z.string()),
  injection: z
    .object({ text: z.string(), role: RoleSchema, forbidden: z.array(z.string()) })
    .optional(),
});

export type Gold = z.infer<typeof GoldSchema>;

const RunRecordSchema = z.object({
  stopReason: z.string().nullable(),
  usage: z.object({
    input: z.number(),
    cacheWrite: z.number(),
    cacheRead: z.number(),
    output: z.number(),
  }),
  costUsd: z.number(),
  answer: z.unknown(),
});

export type RunRecord = z.infer<typeof RunRecordSchema>;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function loadCases(): Gold[] {
  return readdirSync(SAMPLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((id) => GoldSchema.parse(readJson(join(SAMPLES_DIR, id, 'gold.json'))));
}

export function pdfBase64(id: string): string {
  return readFileSync(join(SAMPLES_DIR, id, 'cv.pdf')).toString('base64');
}

export function runDir(fassung: string): string {
  return join(SUITE_DIR, 'runs', fassung);
}

export function runFile(fassung: string, id: string, run: number): string {
  return join(runDir(fassung), id, `run-${run}.json`);
}

export function readRun(fassung: string, id: string, run: number): RunRecord | undefined {
  const path = runFile(fassung, id, run);
  return existsSync(path) ? RunRecordSchema.parse(readJson(path)) : undefined;
}
