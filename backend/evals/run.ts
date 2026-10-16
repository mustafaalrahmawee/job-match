import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { costUsd } from '../src/llm/costs.js'
import { type ChatSettings, coachChatRequest, type Variant } from '../src/prompts/coach_chat.js'
import { cvAnalysisRequest } from '../src/prompts/cv_analysis.js'
import { type BatchRequest, claudeForBatches, collectBatch, createBatch } from './batch.js'
import { countWords, type RunRecord } from './checks.js'

export const EVALS = dirname(fileURLToPath(import.meta.url))
export const RUNS = [1, 2, 3]

const OUTPUT_GUESS = 1500

const REQUESTS: Record<string, (gold: Record<string, unknown>, variant: Variant) => MessageCreateParamsNonStreaming> = {
  coach_chat: (gold, variant) =>
    coachChatRequest(gold.messages as MessageParam[], { quality: gold.quality, effort: gold.effort } as ChatSettings, variant),
  cv_analysis: (gold, variant) =>
    cvAnalysisRequest(readFileSync(join(EVALS, 'corpus', 'cvs', gold.id as string, 'cv.pdf')).toString('base64'), variant),
}

export function sampleNames(unit: string): string[] {
  return readdirSync(join(EVALS, unit, 'samples'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export async function run(unit: string, fassung: string, variant: Variant, confirmed: boolean): Promise<void> {
  const build = REQUESTS[unit]
  if (!build) throw new Error(`evals run does not know the unit ${unit}`)
  const dir = join(EVALS, unit, 'runs', fassung)
  const metaPath = join(dir, 'meta.json')

  if (!existsSync(metaPath)) {
    const cases = sampleNames(unit).map((name) => ({
      name,
      params: build(readJson(join(EVALS, unit, 'samples', name, 'gold.json')), variant),
    }))
    const requests = cases.flatMap(({ name, params }) =>
      RUNS.map((n): BatchRequest => ({ custom_id: `${name}--${n}`, params })),
    )
    const first = requests[0].params
    const effort = variant.effort ?? 'per case'
    const quality = variant.quality ?? 'per case'
    const estimate = await estimateUsd(requests)
    console.log(
      `${unit} ${fassung}: ${requests.length} requests, ${first.model} effort ${effort}, quality ${quality}\n` +
        `Estimated cost (batch): ${usd(estimate.expected)}, at most ${usd(estimate.ceiling)} if every answer hits max_tokens`,
    )
    if (!confirmed) {
      console.log('Nothing sent. Run again with --yes to start the batch.')
      return
    }
    const batchId = await createBatch(requests)
    mkdirSync(dir, { recursive: true })
    writeJson(metaPath, {
      unit,
      fassung,
      model: first.model,
      effort,
      quality,
      max_tokens: first.max_tokens,
      system: first.system,
      requests: Object.fromEntries(
        cases.map(({ name, params }) => [
          name,
          { thinking: params.thinking?.type ?? null, effort: params.output_config?.effort ?? null },
        ]),
      ),
      runs: RUNS.length,
      batch_id: batchId,
      created_at: new Date().toISOString(),
      estimate_usd: estimate.expected,
      ceiling_usd: estimate.ceiling,
    })
    console.log(`Batch ${batchId} created.`)
  }

  const meta = readJson<Record<string, unknown> & { batch_id: string; model: string }>(metaPath)
  if (meta.cost_usd !== undefined) {
    console.log(`${unit} ${fassung} is complete; nothing to fetch.`)
    return
  }
  const { results, latencySeconds } = await collectBatch(meta.batch_id)
  const rows = ['case\trun\tstop_reason\twords\tinput_tokens\toutput_tokens\tcost_usd']
  let total = 0
  for (const [id, result] of [...results].sort(([a], [b]) => a.localeCompare(b))) {
    const name = id.slice(0, id.lastIndexOf('--'))
    const n = id.slice(id.lastIndexOf('--') + 2)
    const record: RunRecord =
      typeof result === 'string'
        ? { text: '', stop_reason: null, input_tokens: 0, output_tokens: 0, cost_usd: 0, error: result }
        : {
            text: result.content.map((block) => (block.type === 'text' ? block.text : '')).join(''),
            stop_reason: result.stop_reason,
            input_tokens: result.usage.input_tokens,
            output_tokens: result.usage.output_tokens,
            cost_usd: costUsd(meta.model, result.usage, true),
            error: null,
          }
    total += record.cost_usd
    mkdirSync(join(dir, name), { recursive: true })
    writeJson(join(dir, name, `run-${n}.json`), record)
    rows.push(
      [name, n, record.stop_reason ?? record.error, countWords(record.text), record.input_tokens, record.output_tokens, record.cost_usd.toFixed(6)].join('\t'),
    )
  }
  writeFileSync(join(dir, 'metrics.tsv'), `${rows.join('\n')}\n`)
  writeJson(metaPath, { ...meta, latency_s: latencySeconds, cost_usd: total })
  console.log(`${results.size} answers written to ${dir}; cost ${usd(total)}, batch took ${latencySeconds} s.`)
}

async function estimateUsd(requests: BatchRequest[]): Promise<{ expected: number; ceiling: number }> {
  const client = claudeForBatches()
  let expected = 0
  let ceiling = 0
  for (const { params } of requests.filter((_, i) => i % RUNS.length === 0)) {
    const { input_tokens } = await client.messages.countTokens({
      model: params.model,
      system: params.system,
      messages: params.messages,
      thinking: params.thinking,
      output_config: params.output_config,
    })
    const usage = { input_tokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    expected += RUNS.length * costUsd(params.model, { ...usage, output_tokens: OUTPUT_GUESS }, true)
    ceiling += RUNS.length * costUsd(params.model, { ...usage, output_tokens: params.max_tokens }, true)
  }
  return { expected, ceiling }
}

function usd(value: number): string {
  return `$${value.toFixed(4)}`
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
