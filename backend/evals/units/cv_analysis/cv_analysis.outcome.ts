import { APIError } from '@anthropic-ai/sdk'
import type { Message } from '@anthropic-ai/sdk/resources/messages'
import { structuredOutput, type SendResult } from '../../../src/llm/send.js'
import type { AnalysisError } from '../../../src/modules/cvs/cvs.schemas.js'
import { cvAnalysisResult } from '../../../src/prompts/cv_analysis/cv_analysis.result.js'
import { cvAnalysisSchema, type CvAnalysis, type SuspiciousText } from '../../../src/prompts/cv_analysis/cv_analysis.schemas.js'

export type Outcome =
  | { status: 'ready'; analysis: CvAnalysis; error: null }
  | { status: 'failed'; analysis: null; error: AnalysisError }

export type Findings = { suspiciousText: SuspiciousText; hits: number } | null

const CV_LANGUAGES = new Set(['de', 'en'])

export function failed(error: AnalysisError): Outcome {
  return { status: 'failed', analysis: null, error }
}

export function evaluate(message: Message): { outcome: Outcome; findings: Findings } {
  const output = structuredOutput(sendResult(message), cvAnalysisSchema)
  if ('error' in output) return { outcome: failed(output.error), findings: null }
  const { analysis, suspiciousText, hits } = cvAnalysisResult(output.data)
  const findings = { suspiciousText, hits }
  if (!analysis.is_cv) return { outcome: failed('not_cv'), findings }
  if (!CV_LANGUAGES.has(analysis.language.toLowerCase())) return { outcome: failed('language'), findings }
  return { outcome: { status: 'ready', analysis, error: null }, findings }
}

export function abortError(error: unknown, aborted: boolean): AnalysisError {
  const tooLong =
    error instanceof APIError && (error.status === 413 || (error.status === 400 && /too long/i.test(error.message)))
  return aborted ? 'timeout' : tooLong ? 'too_long' : 'unavailable'
}

function sendResult(message: Message): SendResult {
  if (!message.stop_reason) throw new Error('The message ended without a stop reason')
  return {
    content: message.content,
    stopReason: message.stop_reason,
    stopDetails: message.stop_details,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    webSearches: message.usage.server_tool_use?.web_search_requests ?? 0,
  }
}
