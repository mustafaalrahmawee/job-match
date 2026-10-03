import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';
import type { Effort } from '@job-match/shared';
import type { Logger } from 'pino';

import type { Config } from '../config';

export function createLlmClient(config: Config): Anthropic {
  return new Anthropic({
    apiKey: config.anthropicApiKey,
    baseURL: config.anthropicBaseUrl,
    timeout: config.llmTimeoutMs,
    maxRetries: config.llmMaxRetries,
  });
}

export function answerText(message: Message): string {
  return message.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
}

export function logLlmCall(
  logger: Logger,
  call: { message: Message; effort: Effort; startedAt: number },
) {
  const metrics = {
    model: call.message.model,
    effort: call.effort,
    inputTokens: call.message.usage.input_tokens,
    outputTokens: call.message.usage.output_tokens,
    durationMs: Math.round(performance.now() - call.startedAt),
  };
  logger.info({ llm: metrics }, 'llm-call');
  return metrics;
}
