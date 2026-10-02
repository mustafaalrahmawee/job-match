import type {
  Message,
  MessageCreateParamsNonStreaming,
  StopReason,
} from '@anthropic-ai/sdk/resources/messages';

import type { LlmClient } from './client';

/**
 * Fake-Client für Tests. **Kein Test ruft ein echtes Modell auf** (docs/STACK.md §5).
 *
 * Die Antworten sind mit den SDK-Typen (`Message`) getippt: Ändert sich die Antwortform, scheitert
 * schon `tsc` hier – nicht erst der Betrieb. Jeder Aufruf wird mitgeschrieben, damit Tests prüfen
 * können, was die App geschickt hat (z. B. ob Effort explizit gesetzt war).
 */

/** Baut eine Antwort in der Form, die die Messages API liefert. */
export function textMessage(
  options: {
    text?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    stopReason?: StopReason;
  } = {},
): Message {
  return {
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: options.model ?? 'fake-model',
    content: [{ type: 'text', text: options.text ?? 'Antwort aus dem Fake.', citations: null }],
    stop_reason: options.stopReason ?? 'end_turn',
    stop_sequence: null,
    stop_details: null,
    container: null,
    diagnostics: null,
    usage: {
      input_tokens: options.inputTokens ?? 12,
      output_tokens: options.outputTokens ?? 8,
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
  };
}

export interface FakeLlmClient extends LlmClient {
  /** Alle Parameter, mit denen `messages.create` aufgerufen wurde – in Aufrufreihenfolge. */
  readonly calls: MessageCreateParamsNonStreaming[];
}

/**
 * Liefert die vorbereiteten Antworten der Reihe nach. Ein `Error` in der Liste wird geworfen statt
 * zurückgegeben – so lassen sich SDK-Fehler (z. B. `AuthenticationError`) nachstellen.
 */
export function createFakeLlmClient(
  responses: (Message | Error)[] = [textMessage()],
): FakeLlmClient {
  const queue = [...responses];
  const calls: MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    messages: {
      create(params) {
        calls.push(params);
        const next = queue.shift();
        if (next === undefined) {
          return Promise.reject(new Error('Der Fake hat keine weitere Antwort vorbereitet.'));
        }
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
      },
    },
  };
}
