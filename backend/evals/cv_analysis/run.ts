import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import type Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';

import { loadConfig } from '../../src/config';
import { answerText, createLlmClient } from '../../src/llm/client';
import { PRICES_USD_PER_MILLION } from '../../src/llm/models';
import {
  CV_ANALYSIS_EFFORT,
  CV_ANALYSIS_MAX_TOKENS,
  CV_ANALYSIS_MODEL,
  CV_ANALYSIS_SYSTEM_PROMPT,
  buildCvAnalysisRequest,
} from '../../src/profile/profile.prompts';
import { RUNS, loadCases, pdfBase64, readRun, runDir, runFile, writeJson } from './suite';
import type { RunRecord } from './suite';

const CACHE_WRITE_1H = 2;
const CACHE_READ = 0.1;
const BATCH_DISCOUNT = 0.5;
const POLL_MS = 30_000;

const EffortArg = z.enum(['low', 'medium', 'high']);

function costUsd(model: string, usage: RunRecord['usage']): number {
  const price = PRICES_USD_PER_MILLION[model];
  if (!price) throw new Error(`Kein Preis für ${model} in PRICES_USD_PER_MILLION`);
  const input = usage.input + usage.cacheWrite * CACHE_WRITE_1H + usage.cacheRead * CACHE_READ;
  return ((input * price.input + usage.output * price.output) / 1_000_000) * BATCH_DISCOUNT;
}

function parseAnswer(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toRecord(model: string, message: Message): RunRecord {
  const usage = {
    input: message.usage.input_tokens,
    cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
    cacheRead: message.usage.cache_read_input_tokens ?? 0,
    output: message.usage.output_tokens,
  };
  return {
    stopReason: message.stop_reason,
    usage,
    costUsd: costUsd(model, usage),
    answer: parseAnswer(answerText(message)),
  };
}

async function waitForBatch(llm: Anthropic, batchId: string) {
  for (;;) {
    const batch = await llm.messages.batches.retrieve(batchId);
    const { processing, succeeded, errored } = batch.request_counts;
    console.log(
      `  ${batch.processing_status}: ${processing} offen, ${succeeded} fertig, ${errored} Fehler`,
    );
    if (batch.processing_status === 'ended') return batch;
    await sleep(POLL_MS);
  }
}

function writeMetrics(fassung: string, model: string, effort: string): number {
  const header = 'case\trun\tmodel\teffort\tstop\tinput\tcache_write\tcache_read\toutput\tcost_usd';
  let total = 0;
  const rows = loadCases().flatMap((gold) =>
    RUNS.flatMap((run) => {
      const record = readRun(fassung, gold.id, run);
      if (!record) return [];
      total += record.costUsd;
      const { input, cacheWrite, cacheRead, output } = record.usage;
      return [
        [gold.id, run, model, effort, record.stopReason, input, cacheWrite, cacheRead, output]
          .concat(record.costUsd.toFixed(5))
          .join('\t'),
      ];
    }),
  );
  writeFileSync(join(runDir(fassung), 'metrics.tsv'), [header, ...rows].join('\n') + '\n');
  return total;
}

const MetaSchema = z.object({
  model: z.string(),
  effort: z.string(),
  maxTokens: z.number(),
  systemPrompt: z.string(),
  batches: z.array(
    z.object({
      id: z.string(),
      runs: z.array(z.number()),
      requests: z.number(),
      seconds: z.number(),
    }),
  ),
});

function readMeta(fassung: string, model: string, effort: string) {
  const path = join(runDir(fassung), 'meta.json');
  const meta: z.infer<typeof MetaSchema> = existsSync(path)
    ? MetaSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : {
        model,
        effort,
        maxTokens: CV_ANALYSIS_MAX_TOKENS,
        systemPrompt: CV_ANALYSIS_SYSTEM_PROMPT,
        batches: [],
      };
  if (meta.model !== model || meta.effort !== effort) {
    throw new Error(
      `Fassung ${fassung} lief mit ${meta.model} ${meta.effort} – neue Fassung wählen`,
    );
  }
  return { path, meta };
}

async function main() {
  const [fassung, model = CV_ANALYSIS_MODEL, effortArg = CV_ANALYSIS_EFFORT] =
    process.argv.slice(2);
  if (!fassung) throw new Error('Aufruf: pnpm eval:cv:run <fassung> [modell] [effort]');
  const effort = EffortArg.parse(effortArg);
  const config = loadConfig();
  if (new URL(config.anthropicBaseUrl).host !== 'api.anthropic.com') {
    throw new Error('Die Eval braucht die Anthropic-API (Message Batches), nicht z.ai');
  }
  const llm = createLlmClient(config);
  const cases = loadCases();
  const { path, meta } = readMeta(fassung, model, effort);
  writeJson(path, meta);

  for (const runs of [[1], [2, 3]]) {
    const requests = cases.flatMap((gold) =>
      runs
        .filter((run) => !existsSync(runFile(fassung, gold.id, run)))
        .map((run) => ({
          custom_id: `${gold.id}--${run}`,
          params: buildCvAnalysisRequest(pdfBase64(gold.id), CV_ANALYSIS_MAX_TOKENS, {
            cacheDocument: true,
            model,
            effort,
          }),
        })),
    );
    if (requests.length === 0) continue;
    const created = await llm.messages.batches.create({ requests });
    console.log(`Batch ${created.id}: Lauf ${runs.join('+')}, ${requests.length} Anfragen`);
    const batch = await waitForBatch(llm, created.id);
    for await (const entry of await llm.messages.batches.results(batch.id)) {
      const [id = '', run = ''] = entry.custom_id.split('--');
      if (entry.result.type !== 'succeeded') {
        console.warn(`  ${entry.custom_id}: ${entry.result.type} – beim nächsten Aufruf neu`);
        continue;
      }
      writeJson(runFile(fassung, id, Number(run)), toRecord(model, entry.result.message));
    }
    const seconds = (Date.parse(batch.ended_at ?? '') - Date.parse(batch.created_at)) / 1000;
    meta.batches.push({ id: batch.id, runs, requests: requests.length, seconds });
    writeJson(path, meta);
  }

  const total = writeMetrics(fassung, model, effort);
  console.log(
    `Fertig: ${fassung}, Kosten ${total.toFixed(4)} $ – weiter mit pnpm eval:cv:check ${fassung}`,
  );
}

await main();
