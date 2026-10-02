import type { Usage } from '@anthropic-ai/sdk/resources/messages';
import type { Logger } from 'pino';

import type { Effort } from './models';

/**
 * Kostenprotokoll: Jede Modellanfrage hinterlässt Modell, Effort, Tokens und Dauer
 * (docs/STUFEN.md §1, „Kosten sichtbar machen“). Bewusst nichts vom Inhalt – nur Zahlen, die man
 * addieren kann.
 */
export interface LlmCallMetrics {
  readonly model: string;
  readonly effort: Effort;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
}

export function metricsFromUsage(args: {
  model: string;
  effort: Effort;
  usage: Usage;
  durationMs: number;
}): LlmCallMetrics {
  return {
    model: args.model,
    effort: args.effort,
    inputTokens: args.usage.input_tokens,
    outputTokens: args.usage.output_tokens,
    durationMs: args.durationMs,
  };
}

export function logLlmCall(logger: Logger, metrics: LlmCallMetrics): void {
  logger.info({ llm: metrics }, 'llm-call');
}
