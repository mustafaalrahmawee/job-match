import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { APIError, type Anthropic } from '@anthropic-ai/sdk'
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages'
import type { Variant } from '../../../src/llm/send.js'
import { createClaudeClient } from '../../../src/llm/clients.js'
import { costUsd } from '../../../src/llm/costs.js'
import { CV_ANALYSIS_TIMEOUT_MS } from '../../../src/modules/cvs/cvs.service.js'
import * as cvConfig from '../../../src/prompts/cv_analysis/cv_analysis.config.js'
import { cvAnalysisRequest } from '../../../src/prompts/cv_analysis/cv_analysis.request.js'
import { readCase, releasedIds, type CvCase } from './cv_analysis.cases.js'
import { abortError, evaluate, failed, type Findings, type Outcome } from './cv_analysis.outcome.js'
import { casePdf } from './cv_analysis.pdf.js'

const RUNS_DIR = join(import.meta.dirname, '../../runs/cv_analysis')
const PROMPT_DIR = join(import.meta.dirname, '../../../src/prompts/cv_analysis')

type PromptVersion = { commit: string; uncommittedChanges: boolean }

type ApiError = { name: string; status: number | null }

export async function run(variant: Variant = {}): Promise<void> {
  const ids = releasedIds()
  const client = createClaudeClient()
  const promptVersion = gitVersion()
  const dir = runDir()
  const started = Date.now()
  const totals = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  const skipped: { id: string; error: string }[] = []
  let cases = 0
  for (const id of ids) {
    let evalCase: CvCase
    let pdf: Uint8Array
    try {
      evalCase = readCase(id)
      pdf = await casePdf(evalCase)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      skipped.push({ id, error: message })
      console.error(`${id}: ${message}`)
      process.exitCode = 1
      continue
    }
    writeFileSync(join(dir, `${id}.pdf`), pdf)
    const trace = await traceCase(client, evalCase, pdf, promptVersion, variant)
    writeFileSync(join(dir, `${id}.json`), `${JSON.stringify(trace, null, 2)}\n`)
    cases++
    totals.inputTokens += trace.meta.inputTokens
    totals.outputTokens += trace.meta.outputTokens
    totals.costUsd += trace.meta.costUsd
    console.log(`${id}: ${trace.outcome.status}${trace.outcome.error ? ` ${trace.outcome.error}` : ''}`)
  }
  const summary = {
    date: basename(dir),
    promptVersion,
    model: variant.model ?? cvConfig.MODEL,
    effort: variant.effort ?? cvConfig.EFFORT,
    thinking: cvConfig.THINKING,
    max_tokens: cvConfig.MAX_TOKENS,
    cases,
    skipped,
    ...totals,
    durationMs: Date.now() - started,
  }
  writeFileSync(join(dir, 'run.json'), `${JSON.stringify(summary, null, 2)}\n`)
  console.log(`${dir}: ${cases} Fälle, ${totals.costUsd.toFixed(4)} $`)
}

async function traceCase(
  client: Anthropic,
  evalCase: CvCase,
  pdf: Uint8Array,
  promptVersion: PromptVersion,
  variant: Variant,
) {
  const file = `${evalCase.id}.pdf`
  const request = cvAnalysisRequest(Buffer.from(pdf).toString('base64'), new Date(evalCase.analyzedAt), variant)
  const signal = AbortSignal.timeout(CV_ANALYSIS_TIMEOUT_MS)
  const started = Date.now()
  let message: Message | null = null
  let apiError: ApiError | null = null
  let result: { outcome: Outcome; findings: Findings }
  try {
    message = await client.messages.create(request, { signal })
    result = evaluate(message)
  } catch (error) {
    const status: unknown = error instanceof APIError ? error.status : null
    apiError = {
      name: error instanceof Error ? error.constructor.name : typeof error,
      status: typeof status === 'number' ? status : null,
    }
    result = { outcome: failed(abortError(error, signal.aborted)), findings: null }
  }
  const durationMs = Date.now() - started
  return {
    case: { id: evalCase.id, tuple: evalCase.tuple },
    request: withFile(request, file),
    response: message && {
      id: message.id,
      model: message.model,
      content: message.content,
      stop_reason: message.stop_reason,
      stop_details: message.stop_details,
      usage: message.usage,
    },
    apiError,
    outcome: result.outcome,
    findings: result.findings,
    meta: {
      promptVersion,
      model: message?.model ?? null,
      effort: request.output_config?.effort ?? null,
      thinking: request.thinking ?? null,
      max_tokens: request.max_tokens,
      inputTokens: message?.usage.input_tokens ?? 0,
      outputTokens: message?.usage.output_tokens ?? 0,
      costUsd: message ? costUsd(request.model, message.usage) : 0,
      durationMs,
    },
  }
}

function withFile(request: MessageCreateParamsNonStreaming, file: string) {
  return {
    ...request,
    messages: request.messages.map((message) => ({
      ...message,
      content:
        typeof message.content === 'string'
          ? message.content
          : message.content.map((block) =>
              block.type === 'document' ? { ...block, source: { ...block.source, data: file } } : block,
            ),
    })),
  }
}

function gitVersion(): PromptVersion {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: PROMPT_DIR, encoding: 'utf8' }).trim()
  return { commit: git('rev-parse', 'HEAD'), uncommittedChanges: git('status', '--porcelain', '--', '.') !== '' }
}

function runDir(): string {
  const base = join(RUNS_DIR, new Date().toLocaleDateString('sv-SE'))
  mkdirSync(RUNS_DIR, { recursive: true })
  for (let n = 1; ; n++) {
    const dir = n === 1 ? base : `${base}-${n}`
    try {
      mkdirSync(dir)
      return dir
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
    }
  }
}
