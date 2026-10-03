import Anthropic from '@anthropic-ai/sdk';
import type { StopReason } from '@anthropic-ai/sdk/resources/messages';
import type { ChatEvent, ChatRequest, StoredStopReason } from '@job-match/shared';
import type { Logger } from 'pino';

import type { Config } from '../config';
import {
  appendMessage,
  assertOwned,
  listMessages,
  startConversation,
} from '../conversations/conversations.service';
import type { Db } from '../db';
import { AppError } from '../errors';
import { logLlmCall } from '../llm/client';
import { describeLlmError } from '../llm/errors';
import { resolveModels } from '../llm/models';
import { buildChatRequest } from './chat.prompts';

export class NothingToRetryError extends AppError {
  constructor() {
    super(400, 'nothing_to_retry', 'Es gibt keine Nachricht, auf die der Coach antworten könnte.');
  }
}

function toStoredStopReason(reason: StopReason | null): StoredStopReason {
  if (reason === 'max_tokens') return 'max_tokens';
  if (reason === 'model_context_window_exceeded') return 'context_window';
  return 'end_turn';
}

export interface ChatDeps {
  readonly db: Db;
  readonly llm: Anthropic;
  readonly logger: Logger;
  readonly config: Config;
}

async function openConversation(db: Db, userId: string, request: ChatRequest): Promise<string> {
  if (request.conversationId) {
    await assertOwned(db, userId, request.conversationId);
    return request.conversationId;
  }
  if (request.message === undefined) throw new NothingToRetryError();
  return (await startConversation(db, userId, request.message)).id;
}

export async function startChat(
  { db, llm, logger, config }: ChatDeps,
  { userId, request, signal }: { userId: string; request: ChatRequest; signal: AbortSignal },
): Promise<AsyncGenerator<ChatEvent>> {
  const conversationId = await openConversation(db, userId, request);
  if (request.message !== undefined) {
    await appendMessage(db, userId, conversationId, {
      role: 'user',
      content: [{ type: 'text', text: request.message }],
    });
  }

  const history = await listMessages(db, userId, conversationId, config.chatHistoryLimit);
  if (history.at(-1)?.role !== 'user') throw new NothingToRetryError();

  const model = resolveModels(config.anthropicBaseUrl)[request.model];
  const params = buildChatRequest({
    history,
    model,
    effort: request.effort,
    maxTokens: config.llmMaxTokens,
    historyLimit: config.chatHistoryLimit,
  });

  async function savePartial(text: string, stopReason: StoredStopReason): Promise<void> {
    if (text.trim() === '') return;
    await appendMessage(db, userId, conversationId, {
      role: 'assistant',
      content: [{ type: 'text', text: text.trim() }],
      stopReason,
      model,
      effort: request.effort,
    });
  }

  async function* run(): AsyncGenerator<ChatEvent> {
    yield { type: 'conversation', id: conversationId };

    const startedAt = performance.now();
    let text = '';
    let final;
    try {
      const stream = llm.messages.stream(params, { signal });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          text += event.delta.text;
          yield { type: 'delta', text: event.delta.text };
        }
      }
      final = await stream.finalMessage();
    } catch (error) {
      if (signal.aborted || error instanceof Anthropic.APIUserAbortError) {
        await savePartial(text, 'aborted');
        logger.info({ conversationId, model, answerLength: text.length }, 'chat-aborted');
        return;
      }
      const info = describeLlmError(error);
      const errorName = error instanceof Error ? error.name : typeof error;
      logger.warn({ conversationId, model, code: info.code, errorName }, 'chat-failed');
      await savePartial(text, 'error');
      yield { type: 'error', code: info.code, message: info.message };
      return;
    }

    logLlmCall(logger, { message: final, effort: request.effort, startedAt });

    if (final.stop_reason === 'refusal') {
      logger.info(
        { conversationId, model, category: final.stop_details?.category },
        'chat-refusal',
      );
      yield { type: 'refusal' };
      return;
    }

    const answer = text.trim();
    if (answer === '') {
      logger.warn({ conversationId, model, stopReason: final.stop_reason }, 'chat-empty');
      yield {
        type: 'error',
        code: 'empty_response',
        message: 'Der Coach hat keine Antwort geliefert. Bitte versuche es noch einmal.',
      };
      return;
    }

    const stopReason = toStoredStopReason(final.stop_reason);
    const saved = await appendMessage(db, userId, conversationId, {
      role: 'assistant',
      content: [{ type: 'text', text: answer }],
      stopReason,
      model: final.model,
      effort: request.effort,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    });
    yield { type: 'done', messageId: saved.id, truncated: stopReason !== 'end_turn' };
  }

  return run();
}
